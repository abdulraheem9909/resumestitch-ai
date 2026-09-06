import { useState } from "react";
import { Link } from "react-router-dom";
import { AUTH_API } from "../lib/api.js";
import { Spinner } from "../components/Spinner.jsx";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      // Always shows the same generic confirmation on submit, matching the
      // backend's no-enumeration behavior — whether this email exists or not
      // must never be revealed here either.
      await fetch(`${AUTH_API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <span className="font-mono text-lg font-semibold tracking-wide text-foreground uppercase">ResumeStitch AI</span>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        {submitted ? (
          <CardContent>
            <Alert>
              <AlertDescription>If that email exists, a reset link has been sent.</AlertDescription>
            </Alert>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Spinner />}
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </CardFooter>
          </form>
        )}
        <CardContent className="pt-0">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Back to log in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
