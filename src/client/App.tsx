import { BrowserRouter, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { Collection } from "./pages/Collection";
import { Discover } from "./pages/Discover";
import { DrinkDetail } from "./pages/DrinkDetail";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Profile } from "./pages/Profile";
import { Scan } from "./pages/Scan";

/**
 * Routes are declared in one place and match the five primary tabs, plus the
 * drink detail page. The add-drink flow joins them once accounts exist.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="discover" element={<Discover />} />
          <Route path="drinks/:id" element={<DrinkDetail />} />
          <Route path="scan" element={<Scan />} />
          <Route path="collection" element={<Collection />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
