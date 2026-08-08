import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  UserCheck,
  Globe,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  Download,
  ChevronRight,
  Check
} from 'lucide-react';
import { CandidateProfileAnalysis } from '../../types/profile';
import {
  getAllAnalyzedProfiles,
  setActiveProfile,
  deleteProfileAnalysis,
  createManualProfile,
  exportAllProfilesAsJSON,
} from '../../lib/profileStorage';

interface ProfileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId?: string;
  onSelectProfile: (profile: CandidateProfileAnalysis) => void;
  onAnalyzeActiveTab: () => void;
  onAnalyzeCustomUrl: (url: string) => void;
  onTriggerComparison?: (selectedProfiles?: CandidateProfileAnalysis[]) => void;
  onExploreJobsSelected?: (selectedProfiles: CandidateProfileAnalysis[]) => void;
  onExploreJobsBoth?: () => void;
  initialTab?: 'list' | 'add';
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  isOpen,
  onClose,
  activeProfileId,
  onSelectProfile,
  onAnalyzeActiveTab,
  onAnalyzeCustomUrl,
  onTriggerComparison,
  onExploreJobsSelected,
  onExploreJobsBoth,
  initialTab = 'list',
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>(initialTab);
  const [addMode, setAddMode] = useState<'url' | 'tab' | 'manual'>('url');
  const [profiles, setProfiles] = useState<CandidateProfileAnalysis[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [profileUrl, setProfileUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualSkills, setManualSkills] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProfiles = profiles.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.candidateName && p.candidateName.toLowerCase().includes(q)) ||
      (p.profilePlatform && p.profilePlatform.toLowerCase().includes(q)) ||
      (p.targetRoles && p.targetRoles.some((r) => r.toLowerCase().includes(q))) ||
      (p.technicalSkills && p.technicalSkills.some((s) => s.toLowerCase().includes(q)))
    );
  });

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const list = await getAllAnalyzedProfiles();
      setProfiles(list);
      // Select all profiles by default so user has both profiles selected out of the box
      setSelectedProfileIds(list.map((p) => p.profileId));
    } catch {
      setProfiles([]);
      setSelectedProfileIds([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectProfile = (e: React.MouseEvent, profId: string) => {
    e.stopPropagation();
    setSelectedProfileIds((prev) =>
      prev.includes(profId) ? prev.filter((id) => id !== profId) : [...prev, profId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProfileIds.length === profiles.length) {
      setSelectedProfileIds([]);
    } else {
      setSelectedProfileIds(profiles.map((p) => p.profileId));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
      setErrorMsg('');
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSelect = async (prof: CandidateProfileAnalysis) => {
    await setActiveProfile(prof);
    onSelectProfile(prof);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, profId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this candidate profile?')) {
      await deleteProfileAnalysis(profId);
      await loadProfiles();
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileUrl.trim()) {
      setErrorMsg('Please enter a valid candidate profile URL');
      return;
    }
    let formattedUrl = profileUrl.trim();
    if (!formattedUrl.includes('http://') && !formattedUrl.includes('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    onAnalyzeCustomUrl(formattedUrl);
    onClose();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualRole.trim()) {
      setErrorMsg('Candidate Name and Target Role are required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const skillsArray = manualSkills
        ? manualSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : [manualRole.trim(), 'Technical Architecture'];
      const newProf = await createManualProfile({
        name: manualName.trim(),
        targetRole: manualRole.trim(),
        keySkills: skillsArray,
        platform: 'Manual Entry',
      });
      await setActiveProfile(newProf);
      onSelectProfile(newProf);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create candidate profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#161822] border border-[#232636] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#232636] flex items-center justify-between bg-[#0B0C10]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-display">Candidate Profile Manager</h2>
              <p className="text-[11px] text-slate-400">Switch or add candidate profile intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-[#232636] bg-[#12141D] p-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'list'
                ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Saved Profiles ({profiles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'add'
                ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Add Other Profile</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 font-sans text-xs">
          {/* TAB 1: SAVED PROFILES LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="py-1 px-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold flex items-center gap-1.5 transition shrink-0"
                      title="Select or deselect all saved candidate profiles"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                          selectedProfileIds.length === profiles.length
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : selectedProfileIds.length > 0
                            ? 'bg-indigo-600/40 border-indigo-500/60 text-indigo-200'
                            : 'border-slate-600 bg-slate-900/60 text-transparent'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>
                        {selectedProfileIds.length === profiles.length
                          ? `Select Both / All (${profiles.length})`
                          : selectedProfileIds.length > 0
                          ? `Selected (${selectedProfileIds.length}/${profiles.length})`
                          : `Select All`}
                      </span>
                    </button>

                    <button
                      onClick={() => exportAllProfilesAsJSON()}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition shrink-0"
                      title="Export all analyzed profiles as JSON"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Export JSON</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search profiles by candidate name, role, or skills..."
                      className="w-full py-2 px-3 pl-8 rounded-xl bg-[#0B0C10] border border-[#232636] focus:border-indigo-500 text-white placeholder-slate-500 text-xs outline-none transition"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-slate-400">Loading saved profiles...</p>
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-6 text-center space-y-3 bg-[#0B0C10] rounded-xl border border-[#232636]">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {searchQuery ? 'No Matching Profiles' : 'No Profiles Found'}
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1">
                      {searchQuery
                        ? `No saved profiles match "${searchQuery}".`
                        : 'No candidate profiles analyzed yet. Click below to add your first profile.'}
                    </p>
                  </div>
                  {!searchQuery && (
                    <button
                      onClick={() => setActiveTab('add')}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 inline-flex items-center gap-1.5 transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Candidate Profile</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredProfiles.map((prof) => {
                    const isActive = activeProfileId === prof.profileId;
                    const isSelected = selectedProfileIds.includes(prof.profileId);
                    const topRole = prof.targetRoles?.[0] || prof.headline || '';

                    return (
                      <div
                        key={prof.profileId}
                        onClick={() => handleSelect(prof)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-950/50 to-[#161822] border-indigo-500/60 shadow-md shadow-indigo-950/40'
                            : 'bg-[#0B0C10] border-[#232636] hover:border-indigo-500/30 hover:bg-[#12141D]'
                        }`}
                      >
                        {/* Checkbox toggle for multi-profile choice */}
                        <button
                          type="button"
                          onClick={(e) => toggleSelectProfile(e, prof.profileId)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                              : 'border-slate-700 bg-slate-900/60 text-transparent hover:border-indigo-500/50'
                          }`}
                          title={isSelected ? 'Deselect candidate profile' : 'Select candidate profile'}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">{prof.candidateName}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-bold flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[#9E86FF] font-semibold truncate text-[11px]">
                            {topRole} • <span className="text-slate-400 font-normal">{prof.profilePlatform || 'LinkedIn'}</span>
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span>Readiness: <strong className="text-emerald-400 font-bold">{prof.profileReadinessScore}%</strong></span>
                            {prof.technicalSkills && prof.technicalSkills.length > 0 && (
                              <span className="truncate">Skills: {prof.technicalSkills.slice(0, 3).join(', ')}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(prof);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-semibold text-[11px] transition"
                              title="Set as sole active candidate profile"
                            >
                              Select Single
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(e, prof.profileId)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Delete candidate profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {profiles.length > 0 && (
                <div className="pt-2 space-y-2">
                  {selectedProfileIds.length > 1 ? (
                    <>
                      {onTriggerComparison && (
                        <button
                          onClick={() => {
                            const selectedObjs = profiles.filter((p) => selectedProfileIds.includes(p.profileId));
                            onTriggerComparison(selectedObjs);
                            onClose();
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 font-semibold text-xs transition flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          <span>Compare Selected Profiles ({selectedProfileIds.length})</span>
                        </button>
                      )}
                      {(onExploreJobsSelected || onExploreJobsBoth) && (
                        <button
                          onClick={() => {
                            const selectedObjs = profiles.filter((p) => selectedProfileIds.includes(p.profileId));
                            if (onExploreJobsSelected) {
                              onExploreJobsSelected(selectedObjs);
                            } else if (onExploreJobsBoth) {
                              onExploreJobsBoth();
                            }
                            onClose();
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                        >
                          <span>Explore Jobs for Selected Profiles ({selectedProfileIds.length})</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : selectedProfileIds.length === 1 ? (
                    <>
                      {(onExploreJobsSelected || onExploreJobsBoth) && (
                        <button
                          onClick={() => {
                            const selectedObjs = profiles.filter((p) => selectedProfileIds.includes(p.profileId));
                            if (onExploreJobsSelected) {
                              onExploreJobsSelected(selectedObjs);
                            } else if (onExploreJobsBoth) {
                              onExploreJobsBoth();
                            }
                            onClose();
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                        >
                          <span>Explore Jobs for Selected Profile (1)</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="p-2 text-center text-slate-400 text-xs font-medium bg-[#0B0C10] rounded-xl border border-[#232636]">
                      Please select at least 1 candidate profile to compare or explore jobs.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD NEW PROFILE */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              {/* Sub-modes toggle */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0B0C10] rounded-xl border border-[#232636]">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('url');
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition flex items-center justify-center gap-1 ${
                    addMode === 'url' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Paste URL</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddMode('tab');
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition flex items-center justify-center gap-1 ${
                    addMode === 'tab' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Active Tab</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddMode('manual');
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium text-[11px] transition flex items-center justify-center gap-1 ${
                    addMode === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Manual Form</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* MODE 1: PASTE URL */}
              {addMode === 'url' && (
                <form onSubmit={handleUrlSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium text-[11px] block">
                      Candidate Profile URL (LinkedIn, GitHub, Indeed, etc.)
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={profileUrl}
                        onChange={(e) => setProfileUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/in/username"
                        className="w-full py-2.5 px-3 pl-9 rounded-xl bg-[#0B0C10] border border-[#232636] focus:border-indigo-500 text-white placeholder-slate-500 text-xs outline-none transition"
                      />
                      <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Supports LinkedIn, GitHub, Indeed, Naukri, Glassdoor, and custom URLs.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Profile URL</span>
                  </button>
                </form>
              )}

              {/* MODE 2: ACTIVE TAB */}
              {addMode === 'tab' && (
                <div className="p-4 rounded-xl bg-[#0B0C10] border border-[#232636] space-y-3 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Scan Active Browser Tab</h3>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Navigate your active browser tab to any candidate's profile page on LinkedIn, GitHub, or Indeed, then click below.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onAnalyzeActiveTab();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Scan & Analyze Active Tab</span>
                  </button>
                </div>
              )}

              {/* MODE 3: MANUAL FORM */}
              {addMode === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium text-[11px] block">Full Candidate Name</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Vivek Kumar"
                      className="w-full py-2 px-3 rounded-xl bg-[#0B0C10] border border-[#232636] focus:border-indigo-500 text-white placeholder-slate-500 text-xs outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium text-[11px] block">Target Role / Designation</label>
                    <input
                      type="text"
                      value={manualRole}
                      onChange={(e) => setManualRole(e.target.value)}
                      placeholder="e.g. Frontend Developer / Full Stack AI Engineer"
                      className="w-full py-2 px-3 rounded-xl bg-[#0B0C10] border border-[#232636] focus:border-indigo-500 text-white placeholder-slate-500 text-xs outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium text-[11px] block">Key Technical Skills (comma separated)</label>
                    <input
                      type="text"
                      value={manualSkills}
                      onChange={(e) => setManualSkills(e.target.value)}
                      placeholder="e.g. React, TypeScript, FastAPI, Python, Docker"
                      className="w-full py-2 px-3 rounded-xl bg-[#0B0C10] border border-[#232636] focus:border-indigo-500 text-white placeholder-slate-500 text-xs outline-none transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Create Candidate Profile</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
