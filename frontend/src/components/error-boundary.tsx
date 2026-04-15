import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto max-w-3xl p-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Recovery Needed</CardTitle>
              <CardDescription>
                A rendering error interrupted this view. Reload the page to restore realtime status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-red-700 dark:text-red-300">{this.state.errorMessage || "Unknown error"}</p>
              <Button className="mt-3" onClick={() => window.location.reload()}>
                Reload Dashboard
              </Button>
            </CardContent>
          </Card>
        </section>
      )
    }

    return this.props.children
  }
}
