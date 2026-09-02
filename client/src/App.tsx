import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import PublicInstall from "./pages/PublicInstall";
import ManageHost from "./pages/ManageHost";

function Router() {
  return <Switch>
    <Route path="/" component={PublicInstall} />
    <Route path="/manage" component={ManageHost} />
    <Route path="/dashboard" component={() => <DashboardLayout><Home /></DashboardLayout>} />
    <Route path="/hosts" component={() => <DashboardLayout><Home /></DashboardLayout>} />
    <Route path="/api-keys" component={() => <DashboardLayout><Home /></DashboardLayout>} />
    <Route path="/activity" component={() => <DashboardLayout><Home /></DashboardLayout>} />
    <Route path="/settings" component={() => <DashboardLayout><Home /></DashboardLayout>} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
