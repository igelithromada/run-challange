"use client";

export default function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="loading-skeleton-list" role="status" aria-label="Načítám obsah">
      {Array.from({ length: count }, (_, index) => (
        <div className="loading-skeleton-card" key={index}>
          <span className="loading-skeleton-avatar" />
          <div className="loading-skeleton-lines">
            <span /><span /><span />
          </div>
        </div>
      ))}
    </div>
  );
}
