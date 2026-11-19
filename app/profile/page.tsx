"use client";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import { uploadPhoto } from "../lib/uploadPhoto";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, updatePassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import AvatarCropper from "../components/AvatarCropper";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { UserRound, Mail, KeyRound, LogOut, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUserProfile, invalidateUserProfileCache } from "../lib/services/users";
import { invalidatePublicProfileCache } from "../lib/services/publicProfiles";
import { showAppToast } from "../components/AppToast";

export default function ProfilePage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.uid);
      setEmail(user.email || "");
      try {
        const profile = await getUserProfile(user.uid);
        setNickname(profile?.nickname || "");
        setAvatarUrl(typeof profile?.avatarUrl === "string" ? profile.avatarUrl : "");
      } catch (error) {
        console.error("Nepodařilo se načíst profil:", error);
      }
    });
    return () => unsub();
  }, [router]);

  const flash = (message: string, type: "success" | "error" = "success") => showAppToast(message, type);

  const handleNicknameSave = async () => {
    const value = nickname.trim().replace(/\s+/g, " ");
    if (!value) {
      flash("Přezdívka nesmí být prázdná.", "error");
      return;
    }
    if (value.length > 40) {
      flash("Přezdívka může mít nejvýše 40 znaků.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user || !userId) {
      flash("Nejsi přihlášen.", "error");
      return;
    }
    setSavingNickname(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nickname: value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Přezdívku se nepodařilo uložit.");
      setNickname(typeof result.nickname === "string" ? result.nickname : value);
      invalidatePublicProfileCache(user.uid);
      invalidateUserProfileCache(user.uid);
      flash("Přezdívka uložena.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Přezdívku se nepodařilo uložit.", "error");
    } finally {
      setSavingNickname(false);
    }
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      flash("Povoleny jsou pouze JPG, PNG a WebP.", "error");
      return;
    }
    if (file.size <= 0) {
      flash("Vybraná fotografie je prázdná.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      flash("Nejsi přihlášen.", "error");
      return;
    }

    setAvatarBusy(true);
    try {
      const uploadResult = await uploadPhoto(file, "avatar");
      if (auth.currentUser?.uid !== user.uid) throw new Error("Přihlášení se změnilo.");
      const token = await user.getIdToken();
      const profileResponse = await fetch("/api/settings/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl: uploadResult.secureUrl }),
      });
      const profileResult = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok) throw new Error(profileResult.error || "Avatar se nepodařilo uložit.");

      setAvatarUrl(uploadResult.secureUrl);
      setAvatarFile(null);
      invalidatePublicProfileCache(user.uid);
      invalidateUserProfileCache(user.uid);
      flash("Profilová fotografie byla uložena.");
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      flash("Nové heslo musí mít alespoň 6 znaků.", "error");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      flash("Nová hesla se neshodují.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      flash("Nejsi přihlášen.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      setNewPasswordConfirm("");
      flash("Heslo bylo změněno.");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
      flash(
        code.includes("requires-recent-login")
          ? "Z bezpečnostních důvodů se nejprve odhlaš a znovu přihlas. Potom změnu hesla zopakuj."
          : "Heslo se nepodařilo změnit. Zkus to prosím znovu.",
        "error"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) { flash("Nejsi přihlášen.", "error"); return; }
    setDeletingAccount(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Účet se nepodařilo smazat.");
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      setDeletingAccount(false);
      setDeleteOpen(false);
      flash(error instanceof Error ? error.message : "Účet se nepodařilo smazat.", "error");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <>
      <Navbar title="Můj účet" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />

      <main className="container profile-page">


        <section className="tile profile-card">
          <div className="settings-section-heading">
            <UserRound size={22} />
            <div>
              <h2>Osobní údaje</h2>
              <p>Tyto údaje se používají u tvých aktivit.</p>
            </div>
          </div>

          <label className="settings-field-label">
            Přezdívka
            <input
              value={nickname}
              maxLength={40}
              placeholder="Přezdívka"
              onChange={e => setNickname(e.target.value)}
            />
          </label>
          <button type="button" className="tile-button settings-save-button" onClick={() => void handleNicknameSave()} disabled={savingNickname}>
            {savingNickname ? "Ukládám…" : "Uložit přezdívku"}
          </button>

          <div className="profile-email-row">
            <Mail size={20} />
            <div>
              <strong>E-mail</strong>
              <span>{email || "—"}</span>
            </div>
          </div>
        </section>

        {avatarFile && <AvatarCropper file={avatarFile} busy={avatarBusy} onCancel={() => setAvatarFile(null)} onSave={handleAvatarChange} />}
        <section className="tile settings-avatar">
          <div className="settings-avatar-preview">
            {avatarUrl ? (
              <img src={cloudinaryImageUrl(avatarUrl, 256)} alt="Profilový avatar" loading="lazy" decoding="async" />
            ) : (
              <span>{(nickname || email).charAt(0).toUpperCase() || "?"}</span>
            )}
          </div>
          <div className="settings-avatar-copy">
            <h3>Profilová fotografie</h3>
            <p>Vyber obrázek, který se zobrazí u tvých aktivit.</p>
            <label className="avatar-upload-button">
              {avatarBusy ? "Nahrávám obrázek…" : avatarUrl ? "Změnit fotografii" : "Vybrat fotografii"}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => { const file = e.target.files?.[0]; if (file) setAvatarFile(file); e.target.value = ""; }}
                disabled={avatarBusy}
              />
            </label>
            <small>Před uložením si nastavíš výřez v kruhu.</small>
          </div>
        </section>

        <section className="tile settings-password-section">
          <div className="settings-section-heading">
            <KeyRound size={22} />
            <div>
              <h2>Změna hesla</h2>
              <p>Nastav nové heslo minimálně o 6 znacích.</p>
            </div>
          </div>
          <div className="settings-password-grid">
            <label>
              Nové heslo
              <input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </label>
            <label>
              Potvrzení nového hesla
              <input type="password" autoComplete="new-password" minLength={6} value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} />
            </label>
          </div>
          <button type="button" className="tile-button settings-save-button" onClick={() => void handlePasswordChange()} disabled={savingPassword}>
            {savingPassword ? "Měním heslo…" : "Změnit heslo"}
          </button>
        </section>

        <section className="tile profile-account-actions">
          <button type="button" className="profile-logout-button" onClick={() => void handleLogout()}>
            <LogOut size={19} />
            Odhlásit se
          </button>

          <button type="button" className="profile-delete-account-button" onClick={() => setDeleteOpen(true)} disabled={deletingAccount}>
            <Trash2 size={19} />
            Smazat účet
          </button>

          {deleteOpen && (
            <div className="profile-delete-confirm">
              <div className="profile-delete-confirm-heading">
                <AlertTriangle size={22} />
                <div>
                  <h3>Trvale smazat účet?</h3>
                  <p>Tato akce je nevratná. Smaže se přihlášení, profil, všechny tvoje aktivity, fotografie, komentáře, označení To se mi líbí, upozornění a členství v týmech. Pokud spravuješ tým, správa se předá dalšímu členovi; týmové historické statistiky zůstanou zachované.</p>
                </div>
              </div>
              <div className="profile-delete-confirm-actions">
                <button type="button" className="tile-button profile-delete-cancel" onClick={() => setDeleteOpen(false)} disabled={deletingAccount}>Zrušit</button>
                <button type="button" className="tile-button profile-delete-confirm-button" onClick={() => void handleDeleteAccount()} disabled={deletingAccount}>{deletingAccount ? "Mažu účet…" : "Ano, trvale smazat účet"}</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
