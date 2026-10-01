import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicPortfolio } from "../api/portfolio";
import EmptyState from "../components/EmptyState";
import LoadingGame from "../components/LoadingGame";
import ComicPortfolioTheme from "../components/portfolioThemes/ComicPortfolioTheme";
import DarkTechPortfolioTheme from "../components/portfolioThemes/DarkTechPortfolioTheme";
import MinimalistPortfolioTheme from "../components/portfolioThemes/MinimalistPortfolioTheme";
import { normalizePortfolioTheme } from "../lib/portfolioThemes";
import { apiErrorMessage } from "../lib/utils";
import type { Portfolio } from "../types/portfolio";

export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLoadingGame, setShowLoadingGame] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!slug) return;
      setIsLoading(true);
      setShowLoadingGame(true);
      setError("");
      try {
        const data = await getPublicPortfolio(slug);
        if (!active) return;
        setPortfolio(data);
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
      />
    );
  }

  if (error || !portfolio) {
    return (
      <main className="comic-page flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-xl">
          <EmptyState
            title="Portfolio unavailable"
            body={error || "This public portfolio could not be found."}
            action={
              <Link className="font-comic text-2xl text-comic-pink underline" to="/">
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
