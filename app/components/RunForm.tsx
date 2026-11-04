"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const uploadToCloudinary = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "lhota_unsigned");
  const res = await fetch("https://api.cloudinary.com/v1_1/dvb4jm8cw/image/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Chyba při nahrávání fotografie.");
  const data = await res.json();
  return data.secure_url as string;
};
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function RunForm({ type }: { type: string }) {
  const [showForm, setShowForm] = useState(false);
  const [km, setKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [activityDate, setActivityDate] = useState(localDateTime);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const minutesValue = durationMinutes.trim() === "" ? null : Number(durationMinutes);
  const secondsValue = durationSeconds.trim() === "" ? null : Number(durationSeconds);
  const parsedDuration = minutesValue !== null && secondsValue !== null &&
    Number.isInteger(minutesValue) && minutesValue >= 0 &...[truncated]