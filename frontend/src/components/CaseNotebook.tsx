import { useEffect, useMemo, useState } from 'react';
import { BookOpen, MapPin, Search, X, Check, FileText, NotebookPen, Save, Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import { useGame } from '../context/GameContext';
import * as api from '../lib/api';
import type { MissionNoteEntry } from '../types';

interface CaseNotebookProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatClueKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function CaseNotebook({ isOpen, onClose }: CaseNotebookProps) {
  const { gameState, refreshGameState } = useGame();
  const [draftContent, setDraftContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  const missionNotes = gameState?.missionNotes ?? [];
  const cluesOnFile = gameState?.discoveredClues ?? [];
  const caseId = gameState?.caseId ?? null;
  const currentCityId = gameState?.currentCityId ?? null;
  const currentCity = useMemo(
    () => gameState?.case.cities.find(city => city.id === currentCityId) ?? null,
    [gameState?.case.cities, currentCityId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setDraftContent('');
    setCreateError(null);
    setEditingId(null);
    setEditDraft('');
    setEntryError(null);
  }, [isOpen, caseId, currentCityId]);

  const witnessOrigins = useMemo(() => {
    const map = new Map<string, { witnessName: string; cityName: string }>();

    for (const city of gameState?.case.cities ?? []) {
      for (const witness of city.witnesses) {
        map.set(witness.id, { witnessName: witness.name, cityName: city.name });
      }
    }

    return map;
  }, [gameState?.case.cities]);

  const handleCreate = async () => {
    if (!gameState || creating) return;
    const content = draftContent.trim();
    if (!content) return;

    setCreating(true);
    setCreateError(null);
    try {
      await api.createMissionNote({
        content,
        contextType: currentCityId ? 'city' : 'general',
        contextId: currentCityId,
      });
      setDraftContent('');
      await refreshGameState();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to save note');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (entry: MissionNoteEntry) => {
    setEditingId(entry.id);
    setEditDraft(entry.content);
    setEntryError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const handleSaveEdit = async (entry: MissionNoteEntry) => {
    if (busyEntryId) return;
    const content = editDraft.trim();
    if (!content || content === entry.content) {
      handleCancelEdit();
      return;
    }
    setBusyEntryId(entry.id);
    setEntryError(null);
    try {
      await api.updateMissionNote(entry.id, content);
      await refreshGameState();
      setEditingId(null);
      setEditDraft('');
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'Failed to update note');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleDelete = async (entry: MissionNoteEntry) => {
    if (busyEntryId) return;
    setBusyEntryId(entry.id);
    setEntryError(null);
    try {
      await api.deleteMissionNote(entry.id);
      await refreshGameState();
      if (editingId === entry.id) {
        setEditingId(null);
        setEditDraft('');
      }
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'Failed to delete note');
    } finally {
      setBusyEntryId(null);
    }
  };

  if (!isOpen || !gameState) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-midnight-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-md h-full bg-midnight-900 border-l border-cream-50/[0.08] flex flex-col shadow-2xl overflow-hidden">
        {/* decorative bg */}
        <div className="absolute inset-0 bg-atlas-grid opacity-30 pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-coral-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-cream-50/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="mono-tick text-amber-400">Case File</div>
              <h2 className="font-display italic font-semibold text-lg text-cream-50 leading-tight">Notebook</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-midnight-700 text-dust-400 hover:text-cream-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Crime brief */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-coral-400" />
              <h3 className="mono-tick text-coral-400">Crime Brief</h3>
            </div>
            <div className="dossier rounded-md p-4">
              <p className="text-sm text-cream-200 leading-relaxed">
                {gameState.case.crimeDescription}
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <NotebookPen className="w-3.5 h-3.5 text-magenta-400" />
              <h3 className="mono-tick text-magenta-400">Investigation Notes · {missionNotes.length}</h3>
            </div>
            <div className="dossier rounded-md p-4 space-y-3">
              <p className="text-xs text-dust-300 leading-relaxed">
                Drop short observations, theories, or contradictions. Each note is filed under the place you're standing in right now.
              </p>
              <div className="flex items-center gap-2 mono-tick text-[10px] text-dust-400">
                <MapPin className="w-3 h-3 text-aqua-400" />
                <span>
                  Filing under{' '}
                  <span className="text-aqua-300">
                    {currentCity ? `${currentCity.name}, ${currentCity.country}` : 'General · case-wide'}
                  </span>
                </span>
              </div>
              <div className="space-y-2">
                <textarea
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    setCreateError(null);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreate();
                    }
                  }}
                  placeholder="Note a name, a contradiction, a route change..."
                  className="w-full min-h-24 rounded-md border border-cream-50/[0.08] bg-midnight-950/65 px-3 py-2 text-sm text-cream-100 placeholder:text-dust-500 focus:outline-none focus:border-magenta-400/45 resize-y"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-dust-400 leading-relaxed">
                    {createError
                      ? <span className="text-coral-300">{createError}</span>
                      : creating
                        ? 'Saving note...'
                        : 'Cmd/Ctrl + Enter to save'}
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleCreate(); }}
                    disabled={creating || !draftContent.trim()}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border mono-tick transition ${
                      creating || !draftContent.trim()
                        ? 'bg-midnight-800/60 border-cream-50/[0.08] text-dust-500 cursor-not-allowed'
                        : 'bg-magenta-400/12 border-magenta-400/35 text-magenta-100 hover:bg-magenta-400/20'
                    }`}
                  >
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add note
                  </button>
                </div>
              </div>

              {entryError && (
                <div className="text-[11px] text-coral-300">{entryError}</div>
              )}

              {missionNotes.length > 0 ? (
                <ul className="space-y-2 pt-1">
                  {missionNotes.map(entry => {
                    const isEditing = editingId === entry.id;
                    const isBusy = busyEntryId === entry.id;
                    return (
                      <li
                        key={entry.id}
                        className="rounded-md border border-cream-50/[0.06] bg-midnight-950/55 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 mono-tick text-[10px] text-dust-400">
                          <span className="truncate">
                            {entry.contextLabel
                              ? <><span className="text-magenta-300">{entry.contextType}</span> · {entry.contextLabel}</>
                              : 'General'}
                          </span>
                          <span>{formatTimestamp(entry.updatedAt)}</span>
                        </div>
                        {isEditing ? (
                          <>
                            <textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              className="w-full min-h-20 rounded-md border border-cream-50/[0.08] bg-midnight-950/70 px-3 py-2 text-sm text-cream-100 focus:outline-none focus:border-magenta-400/45 resize-y"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 rounded-md mono-tick text-dust-300 hover:text-cream-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleSaveEdit(entry); }}
                                disabled={isBusy || !editDraft.trim()}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border mono-tick transition ${
                                  isBusy || !editDraft.trim()
                                    ? 'bg-midnight-800/60 border-cream-50/[0.08] text-dust-500 cursor-not-allowed'
                                    : 'bg-magenta-400/12 border-magenta-400/35 text-magenta-100 hover:bg-magenta-400/20'
                                }`}
                              >
                                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-cream-100 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(entry)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md mono-tick text-dust-300 hover:text-cream-50 hover:bg-midnight-800/60"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleDelete(entry); }}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md mono-tick text-coral-300 hover:text-coral-200 hover:bg-coral-500/10"
                              >
                                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[11px] text-dust-400 italic">No notes logged yet on this case.</p>
              )}
            </div>
          </section>

          {/* Cities */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-aqua-400" />
              <h3 className="mono-tick text-aqua-400">Itinerary · {gameState.case.cities.filter(c => c.visited).length}/{gameState.case.cities.length}</h3>
            </div>
            <div className="space-y-2">
              {gameState.case.cities.map((city, idx) => (
                <div
                  key={city.id}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md border ${
                    city.unlocked
                      ? 'bg-midnight-800/60 border-aqua-400/20'
                      : 'bg-midnight-800/30 border-cream-50/[0.05]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center mono-tick text-[9px] shrink-0 ${
                    city.unlocked
                      ? 'bg-aqua-400/15 text-aqua-300 border border-aqua-400/30'
                      : 'bg-midnight-700 text-dust-400 border border-cream-50/[0.06]'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-display italic ${city.unlocked ? 'text-cream-50' : 'text-dust-300'}`}>
                      {city.unlocked ? city.name : 'Route sealed'}
                    </div>
                    <div className="mono-tick text-dust-400">{city.unlocked ? city.country : 'Await route intel'}</div>
                  </div>
                  {city.visited && <Check className="w-4 h-4 text-aqua-400 shrink-0" />}
                </div>
              ))}
            </div>
          </section>

          {/* Clues */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-3.5 h-3.5 text-magenta-400" />
              <h3 className="mono-tick text-magenta-400">Clues on File · {cluesOnFile.length}</h3>
            </div>
            {cluesOnFile.length > 0 ? (
              <div className="space-y-2.5">
                {cluesOnFile.map((clue, i) => {
                  const witnessOrigin = clue.witnessId ? witnessOrigins.get(clue.witnessId) : null;
                  return (
                    <div
                      key={clue.id}
                      className="relative dossier rounded-md p-4 border-l-2 border-l-magenta-400/60"
                    >
                      <div className="absolute top-3 right-3 mono-tick text-dust-400 text-[9px]">
                        № {String(i + 1).padStart(3, '0')}
                      </div>
                      <div className="mb-2">
                        <span className="mono-tick text-[10px] px-1.5 py-0.5 rounded border border-magenta-400/30 bg-midnight-950/60 text-magenta-200">
                          {formatClueKind(clue.kind)}
                        </span>
                      </div>
                      <p className="text-sm text-cream-100 leading-relaxed pr-12">
                        “{clue.content}”
                      </p>
                      {witnessOrigin && (
                        <div className="mt-2.5 mono-tick text-dust-400 normal-case tracking-wider text-[10px]">
                          — Source: <span className="text-amber-400">{witnessOrigin.witnessName}</span> · {witnessOrigin.cityName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dossier rounded-md p-5 text-center">
                <p className="mono-tick text-dust-400">No leads logged yet</p>
                <p className="text-xs text-dust-300 mt-1.5 normal-case tracking-normal font-sans">
                  Move through the case and listen for anything worth keeping on file.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Footer stamp */}
        <div className="relative px-5 py-3 border-t border-cream-50/[0.06] flex items-center justify-between">
          <span className="mono-tick text-dust-400">Eyes Only</span>
          <span className="mono-tick text-coral-400">Dossier № 0451-A</span>
        </div>
      </div>
    </div>
  );
}
