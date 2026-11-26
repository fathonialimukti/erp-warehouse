import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { LetterIcon, SendIcon } from "../landing/_LandingIcons";
import { bookingUrl, contactEmail } from "./marketingConfig";
import { usePageTitle } from "./usePageTitle";

interface InquiryFormState {
  name: string;
  email: string;
  company: string;
  message: string;
}

const EMPTY_FORM: InquiryFormState = {
  name: "",
  email: "",
  company: "",
  message: "",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ContactPage() {
  usePageTitle("Contact — WMS", {
    description:
      "Request a demo or ask about the WMS one-time buyout. Tell us about your warehouse and what you'd like to change.",
  });

  const [form, setForm] = useState<InquiryFormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const nameError = form.name.trim() ? undefined : "Please enter your name.";
  const emailError = !form.email.trim()
    ? "Please enter your email."
    : isValidEmail(form.email)
      ? undefined
      : "Please enter a valid email address.";
  const messageError = form.message.trim()
    ? undefined
    : "Tell us a little about your warehouse.";
  const hasErrors = Boolean(nameError || emailError || messageError);

  const update = (key: keyof InquiryFormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasErrors) return;
    // TODO: wire to backend/email endpoint (no server endpoint exists yet —
    // PLAN §4.5 keeps the contact form client-side only for now).
    setSubmitted(true);
  };

  return (
    <div data-ai-context={JSON.stringify({ section: "marketing-contact" })}>
      <section className="border-b border-border bg-surface py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Request a demo or ask us anything.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Tell us about your warehouse and which process you want to change.
              We&apos;ll reply with next steps — no obligation.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:px-10">
          <Card className="border border-border shadow-sm">
            <Card.Header>
              <Card.Title className="text-lg font-semibold text-foreground">
                Send an inquiry
              </Card.Title>
              <Card.Description className="text-sm text-muted">
                Fields marked required help us get back to you.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {submitted ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-start gap-3 rounded-xl bg-success/10 p-5"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Thanks — your message is ready to send.
                  </p>
                  <p className="text-sm leading-relaxed text-muted">
                    This form is not yet connected to a backend, so nothing was
                    transmitted. Reach us directly at{" "}
                    <a
                      href={`mailto:${contactEmail}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {contactEmail}
                    </a>
                    .
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setForm(EMPTY_FORM);
                      setSubmitted(false);
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField isRequired isInvalid={Boolean(nameError)}>
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                      />
                      {nameError && <FieldError>{nameError}</FieldError>}
                    </TextField>
                    <TextField isRequired isInvalid={Boolean(emailError)}>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@company.com"
                        autoComplete="email"
                      />
                      {emailError && <FieldError>{emailError}</FieldError>}
                    </TextField>
                  </div>

                  <TextField>
                    <Label>Company (optional)</Label>
                    <Input
                      value={form.company}
                      onChange={(e) => update("company", e.target.value)}
                      placeholder="Company name"
                      autoComplete="organization"
                    />
                  </TextField>

                  <TextField isRequired isInvalid={Boolean(messageError)}>
                    <Label>What would you like to talk about?</Label>
                    <TextArea
                      fullWidth
                      rows={5}
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Your warehouses, the processes you run, and what you'd like to change…"
                    />
                    {messageError && <FieldError>{messageError}</FieldError>}
                  </TextField>

                  <Button type="submit" variant="primary">
                    <SendIcon className="size-4" />
                    Send inquiry
                  </Button>
                </form>
              )}
            </Card.Content>
          </Card>

          <div className="space-y-4">
            <Card className="border border-border shadow-sm">
              <Card.Header>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <LetterIcon className="size-5" />
                </div>
                <Card.Title className="text-base font-semibold text-foreground">
                  Email us directly
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {contactEmail}
                </a>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Prefer email? Send the same details and we&apos;ll pick it up
                  there.
                </p>
              </Card.Content>
            </Card>

            <Card className="border border-border shadow-sm">
              <Card.Header>
                <Card.Title className="text-base font-semibold text-foreground">
                  Book a demo
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-medium text-accent hover:underline"
                >
                  {bookingUrl}
                </a>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  We&apos;ll walk through receiving, dispatch, approvals and the
                  3D warehouse view against a live environment.
                </p>
              </Card.Content>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ContactPage;
