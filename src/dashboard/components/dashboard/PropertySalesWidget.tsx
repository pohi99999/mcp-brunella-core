import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Building2, CheckCircle2, ClipboardList, FileCheck2, FileText, Globe2, HelpCircle, Rocket, Search, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";
import { pSalesTrack, formatPSalesPhaseStatus } from "@/data/pSalesTrack";
import { toast } from "sonner";

export function PropertySalesWidget() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3 border-b border-white/[0.04]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-white">
                    {t("property_sales.title")}
                  </CardTitle>
                  <p className="text-sm text-zinc-500">
                    {t("property_sales.description")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  {pSalesTrack.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  {pSalesTrack.trackId}
                </Badge>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  {t("property_sales.phase1_focus")}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                onClick={() => toast.info(`${t("property_sales.architecture")}: ${pSalesTrack.architectureDoc}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                {t("property_sales.architecture")}
              </Button>
              <Button
                className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                onClick={() => toast.success(`${t("property_sales.next_step")}: ${pSalesTrack.nextReadyStep}`)}
              >
                <Rocket className="mr-2 h-4 w-4" />
                {t("property_sales.next_step")}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.core_workflow")}</p>
              <p className="mt-2 text-sm font-semibold text-white">{t("property_sales.core_workflow_desc")}</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.delivery_surfaces")}</p>
              <p className="mt-2 text-sm font-semibold text-white">{t("property_sales.delivery_surfaces_count", { count: pSalesTrack.surfaces.length })}</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.agents")}</p>
              <p className="mt-2 text-sm font-semibold text-white">{t("property_sales.agents_count", { count: pSalesTrack.agents.length })}</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.progress")}</p>
              <p className="mt-2 text-sm font-semibold text-white">{pSalesTrack.progress}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
              <span>{t("property_sales.track_status")}</span>
              <span>{pSalesTrack.currentFocus}</span>
            </div>
            <Progress value={pSalesTrack.progress} className="h-1 bg-white/[0.04]" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="grid h-12 w-full grid-cols-8 rounded-xl bg-white/[0.03] p-1 backdrop-blur-md lg:w-[1520px]">
          <TabsTrigger value="workflow" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.workflow")}
          </TabsTrigger>
          <TabsTrigger value="intake" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.intake")}
          </TabsTrigger>
          <TabsTrigger value="research" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.research")}
          </TabsTrigger>
          <TabsTrigger value="strategy" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.strategy")}
          </TabsTrigger>
          <TabsTrigger value="execution" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.execution")}
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.agents")}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.delivery")}
          </TabsTrigger>
          <TabsTrigger value="context" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            {t("property_sales.tabs.context")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Target className="h-4 w-4 text-primary" />
                {t("property_sales.workflow_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pSalesTrack.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{phase.title}</h3>
                        <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                          {formatPSalesPhaseStatus(phase.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-400">{phase.summary}</p>
                    </div>
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {phase.checkpoints.map((checkpoint) => (
                      <div key={checkpoint} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300">
                        {checkpoint}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intake" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <ClipboardList className="h-4 w-4 text-primary" />
                {t("property_sales.intake_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {t("property_sales.intake_desc")}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.doc_package")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-64 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.intake.documentBuckets.map((bucket) => (
                        <div key={bucket.title} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <p className="text-sm font-semibold text-white">{bucket.title}</p>
                          <div className="mt-2 space-y-1 text-xs text-zinc-400">
                            {bucket.examples.map((example) => (
                              <p key={example}>• {example}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.survey_questions")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-64 pr-3">
                    <ol className="space-y-3 text-sm text-zinc-300">
                      {pSalesTrack.intake.surveyQuestions.map((question, index) => (
                        <li key={question} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          {question}
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.expected_outputs")}</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {pSalesTrack.intake.outputs.map((output) => (
                      <div key={output} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        {output}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Search className="h-4 w-4 text-primary" />
                {t("property_sales.research_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {t("property_sales.research_desc")}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.source_types")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.research.sourceTypes.map((sourceType) => (
                        <div key={sourceType} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                          {sourceType}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.comp_criteria")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <ol className="space-y-3 text-sm text-zinc-300">
                      {pSalesTrack.research.comparableCriteria.map((criterion, index) => (
                        <li key={criterion} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          {criterion}
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.report_output")}</h3>
                  </div>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.valuation_outputs")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.research.valuationOutputs.map((output) => (
                          <div key={output} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            {output}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.risk_flags")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.research.riskFlags.map((risk) => (
                          <div key={risk} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            {risk}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Rocket className="h-4 w-4 text-primary" />
                {t("property_sales.strategy_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {t("property_sales.strategy_desc")}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.channel_options")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.strategy.channelOptions.map((channel) => (
                        <div key={channel} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                          {channel}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.target_segments")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <ol className="space-y-3 text-sm text-zinc-300">
                      {pSalesTrack.strategy.targetSegments.map((segment, index) => (
                        <li key={segment} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          {segment}
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.approval_execution")}</h3>
                  </div>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.approval_steps")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.strategy.approvalSteps.map((step) => (
                          <div key={step} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.execution_paths")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.strategy.executionPaths.map((path) => (
                          <div key={path} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            {path}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.report_sections")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pSalesTrack.strategy.reportSections.map((section) => (
                          <Badge key={section} variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execution" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <ClipboardList className="h-4 w-4 text-primary" />
                {t("property_sales.execution_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {t("property_sales.execution_desc")}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.execution_modes")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.execution.executionModes.map((mode) => (
                        <div key={mode} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                          {mode}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.status_feedback")}</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.milestones")}</p>
                        <div className="mt-2 space-y-2">
                          {pSalesTrack.execution.statusMilestones.map((milestone) => (
                            <div key={milestone} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                              {milestone}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.feedback_loops")}</p>
                        <div className="mt-2 space-y-2">
                          {pSalesTrack.execution.feedbackLoops.map((loop) => (
                            <div key={loop} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                              {loop}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">{t("property_sales.audit_report")}</h3>
                  </div>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.audit_trail")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.execution.auditTrail.map((entry) => (
                          <div key={entry} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.report_sections")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pSalesTrack.execution.reportSections.map((section) => (
                          <Badge key={section} variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.closing_questions")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.execution.questions.map((question, index) => (
                          <div key={question} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            {question}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Users className="h-4 w-4 text-primary" />
                {t("property_sales.agent_roles")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pSalesTrack.agents.map((agent) => (
                <div key={agent} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-zinc-200">{agent}</span>
                  <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                    core
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Building2 className="h-4 w-4 text-primary" />
                  {t("property_sales.delivery_enterprise")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-400">
                <p>{t("property_sales.delivery_enterprise_desc1")}</p>
                <p>{t("property_sales.delivery_enterprise_desc2")}</p>
              </CardContent>
            </Card>
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Globe2 className="h-4 w-4 text-primary" />
                  {t("property_sales.delivery_standalone")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-400">
                <p>{t("property_sales.delivery_standalone_desc1")}</p>
                <p>{t("property_sales.delivery_standalone_desc2")}</p>
              </CardContent>
            </Card>
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {t("property_sales.delivery_cloudflare")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-zinc-400">
                <p>{pSalesTrack.cloudflareDecision.recommendedPath}</p>
                <ScrollArea className="h-64 pr-3">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.storage_state")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.cloudflareDecision.storageOptions.map((option) => (
                          <div key={option} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.runtime_hosting")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.cloudflareDecision.runtimeOptions.map((option) => (
                          <div key={option} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            {option}
                          </div>
                        ))}
                        {pSalesTrack.cloudflareDecision.hostingOptions.map((option) => (
                          <div key={option} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.decision_criteria")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pSalesTrack.cloudflareDecision.decisionCriteria.map((criterion) => (
                          <Badge key={criterion} variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {criterion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.open_questions")}</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.cloudflareDecision.openQuestions.map((question, index) => (
                          <div key={question} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            {question}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="context" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <FileText className="h-4 w-4 text-primary" />
                {t("property_sales.context_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-400">
              <p>{t("property_sales.context_desc")}</p>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.arch_doc")}</p>
                <p className="mt-2 font-mono text-xs text-zinc-200">{pSalesTrack.architectureDoc}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.next_step")}</p>
                  <p className="mt-2 text-zinc-200">{pSalesTrack.nextReadyStep}</p>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("property_sales.progress")}</p>
                  <p className="mt-2 text-zinc-200">{pSalesTrack.progress}% · {pSalesTrack.currentFocus}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <FileText className="h-4 w-4 text-primary" />
            {t("property_sales.output_focus_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          {t("property_sales.output_focus_desc")}
        </CardContent>
      </Card>
    </div>
  );
}
