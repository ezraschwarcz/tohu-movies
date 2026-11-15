"use client";

import { Component, type ReactNode } from "react";
import { posterUrl } from "@/lib/films";
import type { Film } from "@/lib/types";

/** Keeps a player failure from taking the whole page down. If the
 *  player throws while starting, the rest of the film page (details,
 *  comments, more films) stays up, and this shows the film's still
 *  with a retry button and the technical reason in small print. */
export default class PlayerBoundary extends Component<
  { film: Film; children: ReactNode },
  { error: Error | null; attempt: number }
> {
  state = { error: null as Error | null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { film: Film }) {
    // A different film gets a fresh start.
    if (prev.film.slug !== this.props.film.slug && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      return <div key={attempt}>{this.props.children}</div>;
    }
    return (
      <div className="player-placeholder player-failed" role="alert">
        <img
          src={posterUrl(this.props.film, 1280)}
          alt=""
          width={1280}
          height={720}
        />
        <div className="player-failed-body">
          <p>The player could not start.</p>
          <button
            type="button"
            className="play-btn"
            onClick={() =>
              this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))
            }
          >
            Try again
          </button>
          <p className="error-detail">{String(error.message).slice(0, 240)}</p>
        </div>
      </div>
    );
  }
}
