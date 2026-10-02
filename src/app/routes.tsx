import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { HomePage } from "../pages/home";
import { BoardPage } from "../pages/board";
import { NotFoundPage } from "../pages/NotFoundPage";

const routes: RouteObject[] = [
  { path: "/", element: <BoardPage /> },
  { path: "/board", element: <BoardPage /> },
  { path: "*", element: <NotFoundPage /> },
];

// The RiverX editor preview serves the app under /preview/<session>/__frame/;
// without this basename every route would match the 404 page there.
const previewBasename = window.location.pathname.match(/^\/preview\/[^/]+\/__frame/)?.[0];

export const router = createBrowserRouter(routes, { basename: previewBasename });
