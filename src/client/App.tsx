import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "./theme";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/States";
import { Discover } from "./pages/Discover";
import { Home } from "./pages/Home";

/**
 * Home and Discover ship in the main bundle: they are where almost everyone
 * lands, so splitting them would only add a round trip before first paint.
 *
 * Everything else loads on demand. Scan is the clearest win — it pulls in the
 * barcode scanner, which most visits never touch and which iOS cannot use at
 * all — but the same reasoning covers the account and contribution screens,
 * which someone browsing the catalogue may never open.
 */
const DrinkDetail = lazy(() =>
  import("./pages/DrinkDetail").then((m) => ({ default: m.DrinkDetail })),
);
const AddDrink = lazy(() =>
  import("./pages/AddDrink").then((m) => ({ default: m.AddDrink })),
);
const Scan = lazy(() => import("./pages/Scan").then((m) => ({ default: m.Scan })));
const Collection = lazy(() =>
  import("./pages/Collection").then((m) => ({ default: m.Collection })),
);
const Wantlist = lazy(() =>
  import("./pages/Wantlist").then((m) => ({ default: m.Wantlist })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile })),
);
const SignIn = lazy(() =>
  import("./pages/SignIn").then((m) => ({ default: m.SignIn })),
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((m) => ({ default: m.NotFound })),
);

/**
 * Routes are declared in one place and match the five primary tabs, plus the
 * drink detail, wantlist, contribution and sign-in pages.
 *
 * There is no route guard component. Collection, Wantlist and Profile render a
 * sign-in prompt in place of their content when signed out, which keeps the
 * bottom navigation working and avoids bouncing people to a login screen they
 * did not ask for. The Worker is what actually enforces access.
 */
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="discover" element={<Discover />} />
              {/* Declared before drinks/:id so "new" is not captured as an id. */}
              <Route
                path="drinks/new"
                element={
                  <Lazy>
                    <AddDrink />
                  </Lazy>
                }
              />
              <Route
                path="drinks/:id"
                element={
                  <Lazy>
                    <DrinkDetail />
                  </Lazy>
                }
              />
              <Route
                path="scan"
                element={
                  <Lazy>
                    <Scan />
                  </Lazy>
                }
              />
              <Route
                path="collection"
                element={
                  <Lazy>
                    <Collection />
                  </Lazy>
                }
              />
              <Route
                path="profile"
                element={
                  <Lazy>
                    <Profile />
                  </Lazy>
                }
              />
              <Route
                path="wantlist"
                element={
                  <Lazy>
                    <Wantlist />
                  </Lazy>
                }
              />
              <Route
                path="signin"
                element={
                  <Lazy>
                    <SignIn />
                  </Lazy>
                }
              />
              <Route
                path="*"
                element={
                  <Lazy>
                    <NotFound />
                  </Lazy>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Suspense boundary for a lazily loaded route.
 *
 * One per route rather than a single boundary around the whole outlet, so a
 * chunk that is still downloading only replaces the page body — the header and
 * bottom navigation stay put, which is what stops a fast tab switch flashing
 * an empty screen.
 */
function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading" />}>{children}</Suspense>;
}
