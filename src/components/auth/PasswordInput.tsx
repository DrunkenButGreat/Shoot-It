"use client";

import { useI18n } from "@/components/I18nProvider";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${props.className || ""} pr-12`}
      />
      <button
        type="button"
        aria-label={t(visible ? "auth.hidePassword" : "auth.showPassword")}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
