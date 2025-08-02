"use client";
import React from "react";
import { HslColorPicker, HslColor } from "react-colorful";

type Props = {
  color: HslColor;
  onChange: (color: HslColor) => void;
};

export default function CustomColorPicker({ color, onChange }: Props) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-white shadow-lg w-full max-w-xs">
      <HslColorPicker color={color} onChange={onChange} />
      <div className="mt-4 text-sm">
        h: {Math.round(color.h)}, s: {Math.round(color.s)}%, l: {Math.round(color.l)}%
      </div>
    </div>
  );
}
