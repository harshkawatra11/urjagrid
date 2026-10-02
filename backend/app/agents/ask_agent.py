"""Typed "Ask" agent (B11): Gemini-backed (``gemini-2.5-flash``), restricted
to calling only the read-only tool layer in ``app/tools``. The agent's job
is explanation only -- "engines decide, models only phrase" -- so every
number/name/status in its final answer must trace back to a tool result
from this turn.

Runs correctly and is fully unit-testable with ``MockLlmClient`` when
``GEMINI_API_KEY`` isn't configured in this environment; ``GeminiLlmClient``
is the real integration point, exercised only when a live key is present.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

GEMINI_MODEL = "gemini-2.5-flash"
MAX_TOOL_ROUNDS = 5


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class LlmTurn:
    """One model turn: either a final text answer, or one/more tool calls
    the agent loop must execute before asking the model again.
    """

    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def is_final(self) -> bool:
        return not self.tool_calls


class LlmClient(Protocol):
    def generate(self, history: list[dict[str, Any]], tool_schemas: list[dict]) -> LlmTurn: ...


class MockLlmClient:
    """Deterministic, scripted client for tests/no-live-key runs: a queue of
    pre-built ``LlmTurn``s returned in order, one per call to ``generate``.
    """

    def __init__(self, scripted_turns: list[LlmTurn]) -> None:
        self._turns = list(scripted_turns)
        self.calls: list[list[dict[str, Any]]] = []

    def generate(self, history: list[dict[str, Any]], tool_schemas: list[dict]) -> LlmTurn:  # noqa: ARG002
        self.calls.append(history)
        if not self._turns:
            return LlmTurn(text="(mock client ran out of scripted turns)")
        return self._turns.pop(0)


class GeminiLlmClient:
    """Real ``google-genai`` client, constructed lazily so importing this
    module never requires network access or a configured key -- only
    calling ``generate`` does.
    """

    def __init__(self, api_key: str, model: str = GEMINI_MODEL) -> None:
        self.api_key = api_key
        self.model = model

    def generate(self, history: list[dict[str, Any]], tool_schemas: list[dict]) -> LlmTurn:
        from google import genai  # type: ignore[import-not-found]
        from google.genai import types  # type: ignore[import-not-found]

        client = genai.Client(api_key=self.api_key)
        tools = [types.Tool(function_declarations=tool_schemas)]
        contents = [
            {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
            for m in history
            if m["role"] in ("user", "assistant")
        ]
        response = client.models.generate_content(
            model=self.model, contents=contents, config=types.GenerateContentConfig(tools=tools)
        )
        candidate = response.candidates[0]
        tool_calls = [
            ToolCall(name=part.function_call.name, arguments=dict(part.function_call.args or {}))
            for part in candidate.content.parts
            if getattr(part, "function_call", None)
        ]
        if tool_calls:
            return LlmTurn(tool_calls=tool_calls)
        return LlmTurn(text=candidate.content.parts[0].text)


def llm_client_from_env() -> LlmClient:
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        return GeminiLlmClient(api_key)
    return MockLlmClient(
        scripted_turns=[
            LlmTurn(
                text=(
                    "I don't have a live Gemini key configured in this environment, so I can't "
                    "generate a free-form answer right now -- but every grid tool call still works."
                )
            )
        ]
    )


class AskAgentError(RuntimeError):
    """Raised when the agent calls a tool name it was not given."""


@dataclass
class AskAgent:
    """Drives the tool-calling loop: ask the model, execute any tool calls it
    requests against ``tools`` (never any other function), feed the results
    back, repeat until the model returns final text or ``MAX_TOOL_ROUNDS`` is
    hit.
    """

    client: LlmClient
    tools: dict[str, Callable[..., Any]]
    tool_schemas: list[dict]
    system_prompt: str

    def ask(self, user_message: str) -> dict[str, Any]:
        history: list[dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_message},
        ]
        tool_trace: list[dict[str, Any]] = []

        for _ in range(MAX_TOOL_ROUNDS):
            turn = self.client.generate(history, self.tool_schemas)
            if turn.is_final:
                return {"text": turn.text, "tool_trace": tool_trace, "grounded": bool(tool_trace)}

            for call in turn.tool_calls:
                if call.name not in self.tools:
                    raise AskAgentError(f"model requested unknown tool {call.name!r}")
                result = self.tools[call.name](**call.arguments)
                tool_trace.append(
                    {"name": call.name, "arguments": call.arguments, "result": result}
                )
                history.append(
                    {
                        "role": "tool",
                        "content": json.dumps({"name": call.name, "result": result}, default=str),
                    }
                )

        return {
            "text": "I wasn't able to finish looking that up -- please ask your sub-division JE.",
            "tool_trace": tool_trace,
            "grounded": bool(tool_trace),
        }


__all__ = [
    "GEMINI_MODEL",
    "ToolCall",
    "LlmTurn",
    "LlmClient",
    "MockLlmClient",
    "GeminiLlmClient",
    "llm_client_from_env",
    "AskAgentError",
    "AskAgent",
]
