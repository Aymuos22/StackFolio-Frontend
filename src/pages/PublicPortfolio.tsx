import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import EmptyState from "../components/EmptyState";
import LoadingGame from "../components/LoadingGame";
import ComicPortfolioTheme from "../components/portfolioThemes/ComicPortfolioTheme";
import DarkTechPortfolioTheme from "../components/portfolioThemes/DarkTechPortfolioTheme";
import MinimalistPortfolioTheme from "../components/portfolioThemes/MinimalistPortfolioTheme";
import {
  normalizePortfolioTheme,
  readCachedPortfolioTheme,
  writeCachedPortfolioTheme,
} from "../lib/portfolioThemes";
import { apiErrorMessage } from "../lib/utils";
import type { Portfolio, PortfolioTheme } from "../types/portfolio";

export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLoadingGame, setShowLoadingGame] = useState(true);
  // Prefer cached theme on first paint so the shell never flashes comic → other.
  const [shellTheme, setShellTheme] = useState<PortfolioTheme | null>(() => readCachedPortfolioTheme(slug));

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;
      setIsLoading(true);
      setShowLoadingGame(true);
      setError("");
      setShellTheme(readCachedPortfolioTheme(slug));
      setPortfolio(null);
      try {
        const data = await getPublicPortfolio(slug);
        if (!active) return;
        const theme = normalizePortfolioTheme(data.theme);
        setPortfolio(data);
        setShellTheme(theme);
        writeCachedPortfolioTheme(slug, theme);
      } catch (requestError) {
        if (!active) return;
        setError(apiErrorMessage(requestError, "Unable to load public portfolio."));
        setShowLoadingGame(false);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (isLoading || (showLoadingGame && portfolio && !error)) {
    return (
      <LoadingGame
        ready={!isLoading && Boolean(portfolio)}
        onEnter={() => setShowLoadingGame(false)}
        portfolioTheme={shellTheme}
      />
    );
  }

  if (error || !portfolio) {
    const errorTheme = shellTheme ?? "comic";
    return (
      <main
        className={
          errorTheme === "dark-tech"
            ? "hacker-page flex min-h-screen items-center justify-center px-4"
            : errorTheme === "minimalist"
              ? "minimal-page flex min-h-screen items-center justify-center px-4"
              : "comic-page flex min-h-screen items-center justify-center px-4"
        }
      >
        <section className="w-full max-w-xl">
          <EmptyState
            title="Portfolio unavailable"
            body={error || "This public portfolio could not be found."}
            action={
              <Link
                className={
                  errorTheme === "dark-tech"
                    ? "font-mono text-hacker-green underline"
                    : errorTheme === "minimalist"
                      ? "font-display text-stone-800 underline"
                      : "font-comic text-2xl text-comic-pink underline"
                }
                to="/"
              >
                Back to Stackfolio
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  const theme = normalizePortfolioTheme(portfolio.theme);

  if (theme === "minimalist") {
    return <MinimalistPortfolioTheme portfolio={portfolio} />;
  }

  if (theme === "dark-tech") {
    return <DarkTechPortfolioTheme portfolio={portfolio} />;
  }

  return <ComicPortfolioTheme portfolio={portfolio} />;
}
