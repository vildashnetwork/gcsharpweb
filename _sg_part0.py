// pages/StudyGroups.jsx
// WhatsApp-style study group chat with paper sharing, highlights, voice notes and GC AI.
// Real-time delivery over WebSocket (TCP) - see backend/study_groups.py WebSocket handler.

import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/lib/api";
import { authHeaders, groupSocketUrl, voiceNoteUrl } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import GroupMessage from "@/components/studygroup/GroupMessage";
import PaperPicker from "@/components/studygroup/PaperPicker";
import MembersPanel from "@/components/studygroup/MembersPanel";
