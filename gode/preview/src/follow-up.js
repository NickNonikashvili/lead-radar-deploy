"use strict";
// A short follow-up that edits the chat's last request: "Now make it also handle PNG files", "Add a
// --dry-run option", "Can you add comments to it?", "Make it at night instead", "Turn it into a
// song". Shared by the classifier stand-in (providers.js: the job of the chat it continues) and the
// answers (answers.js: the code sample of the request it continues). Only a single sentence that
// starts with an edit verb counts: "Thanks! What does EXIF stand for?" and "What does this line
// do?" stand on their own.

const FOLLOW_UP_MAX_CHARS = 160;
const EDIT_START = /^(?:(?:ok(?:ay)?|now|and|also|then|great|cool|nice|perfect|thanks|thank you|lovely)[,!.]?\s+)*(?:(?:can|could|would|will) you\s+(?:also\s+)?|please\s+(?:also\s+)?)?(?:make|add|change|turn|use|include|remove|drop|rename|handle|support|convert|rewrite|refactor|put|give|let|show|swap|replace|switch|set|move|fix|update|extend|translate|try|redo|do|have|paint|draw)\b/i;

function isEditFollowUp(text) {
  const t = String(text || "").trim();
  return Boolean(t) && t.length <= FOLLOW_UP_MAX_CHARS && !/[.!?…]\s+\S/.test(t) && EDIT_START.test(t);
}

module.exports = { isEditFollowUp, EDIT_START, FOLLOW_UP_MAX_CHARS };
