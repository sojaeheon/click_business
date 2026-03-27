import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { useGame, useGameStore } from "../../store/gameStore";
import { HRAPI } from "../../api/gameApi";
import { BackButton } from "../../app/components/ui/backbutton";
import { useAlertStore } from "../../store/useAlertStore";
import { WORKER_LEVEL_NAMES, WORKER_LEVEL_ICONS, WORKER_LEVEL_IMAGES, getWorkerDefByLevel } from "../../constants/workers";
import { playSfx } from "../../utils/sfx";

// 