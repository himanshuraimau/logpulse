import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AgentConsolePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Console</CardTitle>
        <CardDescription>
          AI RCA actions and reports will be rendered in this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">
          Phase 1 scaffold is ready for backend RCA trigger and report endpoints.
        </p>
      </CardContent>
    </Card>
  )
}
