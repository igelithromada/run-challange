"use client";
import React from "react";
import { HslColorPicker } from "react-colorful";

type Props = {
  color: string;
  onChange: (color: string) => void;
};

export default function CustomColorPicker({ color, onChange }: Props) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-white shadow-lg w-full max-w-xs">
      <HslColorPicker
        color={color}
        onChange={(newColor) => {
          const [h, s, l] = newColor.match(/\d+/g)?.map(Number) || [0, 100, 50];
          const cssColor = `hsl(${h}, ${s}%, ${l}%)`;
          onChange(cssColor);
        }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
