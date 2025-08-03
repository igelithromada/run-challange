<div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "1.5rem",
        width: "100%",
        maxWidth: "300px",
      }}
    >
      {showImageUrl.length > 1 ? (
        <button
          onClick={() =>
            setCurrentImageIndex(
              (currentImageIndex - 1 + showImageUrl.length) % showImageUrl.length
            )
          }
          style={{
            background: "transparent",
            color: "white",
            fontSize: "2rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          ❮
        </button>
      ) : (
        <div style={{ width: "2rem" }} />
      )}

      <button
        onClick={() => setShowImageUrl(null)}
        style={{
          background: "white",
          color: "black",
          border: "none",
          borderRadius: "12px",
          padding: "0.6rem 1.4rem",
          fontWeight: "bold",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Zavřít
      </button>

      {showImageUrl.length > 1 ? (
        <button
          onClick={() =>
            setCurrentImageIndex((currentImageIndex + 1) % showImageUrl.length)
          }
          style={{
            background: "transparent",
            color: "white",
            fontSize: "2rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          ❯
        </button>
      ) : (
        <div style={{ width: "2rem" }} />
      )}
    </div>
  </div>
)}
