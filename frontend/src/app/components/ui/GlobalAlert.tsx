import React from "react";
import { useAlertStore } from "../../../store/useAlertStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

export function GlobalAlert() {
  const { isOpen, message, title, closeAlert, onConfirm } = useAlertStore();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        if (onConfirm) onConfirm();
        closeAlert();
      }
    }}>
      <AlertDialogContent className="z-[9999] border-4 border-slate-800 rounded-2xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-3xl">⚠️</span> {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base font-bold text-slate-600 leading-relaxed mt-4 break-keep">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex gap-2">
          <AlertDialogAction 
            onClick={() => {
              if (onConfirm) onConfirm();
              closeAlert();
            }}
            className="flex-1 font-bold bg-slate-800 text-white hover:bg-slate-700 py-4 text-lg rounded-xl cursor-pointer"
          >
            확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
