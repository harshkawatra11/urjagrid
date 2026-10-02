
import pytest

from app.agents.ask_agent import (
    AskAgent,
    AskAgentError,
    GeminiLlmClient,
    LlmTurn,
    MockLlmClient,
    ToolCall,
    llm_client_from_env,
)


def test_llm_client_from_env_defaults_to_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client = llm_client_from_env()
    assert isinstance(client, MockLlmClient)


def test_llm_client_from_env_uses_gemini_when_key_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    client = llm_client_from_env()
    assert isinstance(client, GeminiLlmClient)


def test_ask_agent_final_text_with_no_tool_calls_is_ungrounded() -> None:
    client = MockLlmClient([LlmTurn(text="Hello, I am Urja.")])
    agent = AskAgent(client=client, tools={}, tool_schemas=[], system_prompt="sys")
    result = agent.ask("hi")
    assert result["text"] == "Hello, I am Urja."
    assert result["grounded"] is False
    assert result["tool_trace"] == []


def test_ask_agent_executes_tool_call_then_returns_final_text() -> None:
    calls = {"kpis": lambda: {"slot": 5}}
    client = MockLlmClient(
        [
            LlmTurn(tool_calls=[ToolCall(name="kpis", arguments={})]),
            LlmTurn(text="The current slot is 5."),
        ]
    )
    agent = AskAgent(client=client, tools=calls, tool_schemas=[], system_prompt="sys")
    result = agent.ask("what slot are we on?")
    assert result["grounded"] is True
    assert result["tool_trace"][0]["result"] == {"slot": 5}
    assert result["text"] == "The current slot is 5."


def test_ask_agent_raises_on_unknown_tool_name() -> None:
    client = MockLlmClient([LlmTurn(tool_calls=[ToolCall(name="not_a_real_tool")])])
    agent = AskAgent(client=client, tools={}, tool_schemas=[], system_prompt="sys")
    with pytest.raises(AskAgentError):
        agent.ask("do the impossible thing")


def test_ask_agent_gives_up_gracefully_after_max_rounds() -> None:
    always_tool_calls = [LlmTurn(tool_calls=[ToolCall(name="noop")]) for _ in range(10)]
    client = MockLlmClient(always_tool_calls)
    agent = AskAgent(
        client=client, tools={"noop": lambda: None}, tool_schemas=[], system_prompt="sys"
    )
    result = agent.ask("loop forever")
    assert "JE" in result["text"]


def test_gemini_client_generate_uses_mocked_sdk(monkeypatch: pytest.MonkeyPatch) -> None:
    import sys
    import types

    fake_genai = types.ModuleType("google.genai")
    fake_types_mod = types.ModuleType("google.genai.types")

    class FakePart:
        def __init__(self, text=None, function_call=None):
            self.text = text
            self.function_call = function_call

    class FakeContent:
        def __init__(self, parts):
            self.parts = parts

    class FakeCandidate:
        def __init__(self, content):
            self.content = content

    class FakeResponse:
        def __init__(self, candidates):
            self.candidates = candidates

    class FakeModels:
        def generate_content(self, model, contents, config):  # noqa: ARG002
            return FakeResponse([FakeCandidate(FakeContent([FakePart(text="mocked answer")]))])

    class FakeClient:
        def __init__(self, api_key):  # noqa: ARG002
            self.models = FakeModels()

    fake_genai.Client = FakeClient
    fake_types_mod.Tool = lambda **kwargs: kwargs
    fake_types_mod.GenerateContentConfig = lambda **kwargs: kwargs

    fake_google = types.ModuleType("google")
    fake_google.genai = fake_genai
    monkeypatch.setitem(sys.modules, "google", fake_google)
    monkeypatch.setitem(sys.modules, "google.genai", fake_genai)
    monkeypatch.setitem(sys.modules, "google.genai.types", fake_types_mod)

    client = GeminiLlmClient(api_key="fake")
    turn = client.generate([{"role": "user", "content": "hi"}], tool_schemas=[])
    assert turn.text == "mocked answer"
    assert turn.is_final
