import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/login-screen";

export const Route = createFileRoute("/login")({ component: LoginPage });
