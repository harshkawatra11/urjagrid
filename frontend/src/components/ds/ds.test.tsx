import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";
import { PanelSkeleton, Skeleton } from "./Skeleton";
import { PageHeader } from "./PageHeader";
import { StatusTag } from "./StatusTag";
import { Delta } from "./Delta";
import { CompareStat } from "./CompareStat";
import { PlanStatusChip, MeterStateChip, CapLevelChip, LeverChip, KindChip } from "./chips";

describe("design system primitives", () => {
  it("renders a Card with title and footer", () => {
    render(
      <Card title="Grid Command" live footer="source: sim">
        content
      </Card>,
    );
    expect(screen.getByText("Grid Command")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders skeletons", () => {
    render(<PanelSkeleton />);
    render(<Skeleton className="h-4" />);
  });

  it("renders a PageHeader with breadcrumbs", () => {
    render(<PageHeader title="Plans" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Plans" }]} />);
    expect(screen.getByRole("heading", { name: "Plans" })).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders StatusTag for all three capability statuses", () => {
    render(
      <>
        <StatusTag status="LIVE" />
        <StatusTag status="WIRED" />
        <StatusTag status="PILOT" />
      </>,
    );
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("WIRED")).toBeInTheDocument();
    expect(screen.getByText("PILOT")).toBeInTheDocument();
  });

  it("renders Delta with correct sign", () => {
    render(<Delta value={3.4} unit="kW" />);
    expect(screen.getByText(/\+3\.4kW/)).toBeInTheDocument();
  });

  it("renders CompareStat", () => {
    render(<CompareStat label="Served" solutionValue={92} baselineValue={81} unit="%" />);
    expect(screen.getByText("Served")).toBeInTheDocument();
    expect(screen.getByText(/vs baseline 81/)).toBeInTheDocument();
  });

  it("renders all chip variants", () => {
    render(
      <>
        <PlanStatusChip status="approved" />
        <MeterStateChip state="capped" />
        <CapLevelChip level="lifeline" />
        <LeverChip lever="behavioral_dr" />
        <KindChip kind="hes" />
      </>,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Capped")).toBeInTheDocument();
    expect(screen.getByText("Lifeline")).toBeInTheDocument();
    expect(screen.getByText("L1 DR")).toBeInTheDocument();
    expect(screen.getByText("HES")).toBeInTheDocument();
  });
});
