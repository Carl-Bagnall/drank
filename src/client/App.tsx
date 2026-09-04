import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { Collection } from "./pages/Collection";
import { Discover } from "./pages/Discover";
import { DrinkDetail } from "./pages/DrinkDetail";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Profile } from "./pages/Profile";
import { Scan } from "./pages/Scan";
import { SignIn } from "./pages/SignIn";

/**
 * Routes are declared in one place and match the five primary tabs, plus the
 * drink detail and sign-in pages.
 *
 * There is no route guard component. Collection and Profile render a sign-in
 * prompt in place of their content when signed out, which keeps the bottom
 * navigation working and avoids bouncing people to a login screen they did
 * not ask for. The Worker is what actually enforces access.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="discover" element={<Discover />} />
            <Route path="drinks/:id" element={<DrinkDetail />} />
            <Route path="scan" element={<Scan />} />
            <Route path="collection" element={<Collection />} />
            <Route path="profile" element={<Profile />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
