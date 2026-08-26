import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload, File as FileIcon, X, Check, AlertCircle, Loader2,
  ChevronRight, ChevronLeft, Megaphone, Leaf, Settings,
  ArrowRight, History, RefreshCw, AlertTriangle, Search,
} from 'lucide-react';
import type { Campaign, CampaignInsert, CampaignType, CampaignPlatform } from '@/lib/supabase';
import {
  createCampaign, createLeadImportRecord,
  fetchAllLeadBankPhones, fetchAllLeadsPhones,
  fetchLeadImports, CAMPAIGN_TYPES, CAMPAIGN_PLATFORMS,
} from '@/lib/crm';
import { normalizePhone, normalizeEmail, normalizeCampaignName, similarity } from '@/lib/normalize';
import { supabase } from '@/lib/supabase';
import { assertWritable } from '@/lib/demoMode';

interface Props {
  campaigns: Campaign[];
  onImported: () => void;
}

type ImportType = 'paid' | 'organic' | 'other';
type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type DupCategory = 'green' | 'yellow' | 'blue' | 'red' | 'invalid';

interface ValidatedRow {
  rowIndex: number;
  name: string;
  phone: string;
  email: string;
  date: string;
  source: string;
  city: string;
  normalizedPhone: string;
  normalizedEmail: string;
  category: DupCategory;
  categoryReason: string;
  sourceClassification: 'organic' | 'paid' | 'unclassified';
  campaignName: string;
  campaignId: string | null;
  inquiryDate: string | null;
  isValid: boolean;
  invalidReason: string;
}

interface CampaignResolution {
  rawName: string;
  normalized: string;
  matchedId: string | null;
  matchedName: string | null;
  possibleMatch: string | null;
  possibleMatchId: string | null;
  decision: 'matched' | 'existing' | 'new' | 'unassigned' | null;
  newCampaignId: string | null;
  affectedCount: number;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Detect Columns' },
  { id: 3, label: 'Map Columns' },
  { id: 4, label: 'Classify' },
  { id: 5, label: 'Campaigns' },
  { id: 6, label: 'Duplicates' },
  { id: 7, label: 'Preview' },
  { id: 8, label: 'Import' },
  { id: 9, label: 'Result' },
];

const NAME_KEYS = ['name', 'full name', 'customer name', 'lead name'];
const PHONE_KEYS = ['phone', 'phone number', 'mobile', 'mobile number', 'contact', 'contact number'];
const EMAIL_KEYS = ['email', 'email address', 'e-mail'];
const DATE_KEYS = ['date', 'lead date', 'inquiry date', 'created date'];
const SOURCE_KEYS = ['lead source', 'source', 'campaign', 'campaign name'];
const CITY_KEYS = ['city', 'location', 'town'];

const ORGANIC_SOURCES = ['website', 'referral', 'inbound call', 'site visit', 'hospitality', 'walk-in', 'walk in', 'whatsapp', 'google', 'organic'];

function findColumn(headers: string[], keys: string[]): string | null {
  for (const key of keys) {
    const found = headers.find((h) => normalizeCampaignName(h) === key);
    if (found) return found;
  }
  for (const key of keys) {
    const found = headers.find((h) => normalizeCampaignName(h).includes(key));
    if (found) return found;
  }
  return null;
}

function parseExcelDate(value: unknown): string | null {
  if (!value || value === '') return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (!str) return null;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${year}-${month}-${day}`);
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`;
  }
  return null;
}

function classifySource(rawSource: string, campaigns: Campaign[]): 'organic' | 'paid' | 'unclassified' {
  const norm = normalizeCampaignName(rawSource);
  if (!norm) return 'unclassified';
  // Check if it matches an organic source
  if (ORGANIC_SOURCES.some((s) => norm.includes(s))) return 'organic';
  // Check if it matches an existing campaign name
  if (campaigns.some((c) => normalizeCampaignName(c.name) === norm)) return 'paid';
  return 'unclassified';
}

const importTypeLabel = (t: ImportType) =>
  t === 'paid' ? 'Paid / Campaign' : t === 'organic' ? 'Organic' : 'Other / Custom';

export default function LeadImport({ campaigns, onImported }: Props) {
  const [step, setStep] = useState<StepId>(1);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string | null>>({});
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [campaignResolutions, setCampaignResolutions] = useState<CampaignResolution[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFatalError, setImportFatalError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number; skippedDup: number; skippedInvalid: number; skippedConflict: number;
    campaignsCreated: number; errors: string[];
  } | null>(null);
  const [history, setHistory] = useState<{ id: string; file_name: string; import_type: string; total_rows: number; new_rows: number; duplicate_rows: number; invalid_rows: number; conflict_rows: number; created_at: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [parseError, setParseError] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors' | 'duplicates' | 'unmatched'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Step 1: Upload & Parse File ---
  async function handleFile(file: File) {
    setParseError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setParseError('No sheet found in the file.'); return; }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (json.length === 0) { setParseError('The file contains no data rows.'); return; }
      const cols = Object.keys(json[0]);
      setFileName(file.name);
      setRawRows(json);
      setHeaders(cols);
      const detected: Record<string, string | null> = {
        name: findColumn(cols, NAME_KEYS),
        phone: findColumn(cols, PHONE_KEYS),
        email: findColumn(cols, EMAIL_KEYS),
        date: findColumn(cols, DATE_KEYS),
        source: findColumn(cols, SOURCE_KEYS),
        city: findColumn(cols, CITY_KEYS),
      };
      setColumnMap(detected);
      setStep(2);
    } catch {
      setParseError('Failed to parse the file. Make sure it is a valid .xlsx, .xls, or .csv file.');
    }
  }

  // --- Step 3: Map Columns → Validate ---
  function runValidation() {
    const nameCol = columnMap.name;
    const phoneCol = columnMap.phone;
    const emailCol = columnMap.email;
    const dateCol = columnMap.date;
    const sourceCol = columnMap.source;
    const cityCol = columnMap.city;

    const rows: ValidatedRow[] = rawRows.map((row, idx) => {
      const name = nameCol ? String(row[nameCol] ?? '').trim() : '';
      const phone = phoneCol ? String(row[phoneCol] ?? '').trim() : '';
      const email = emailCol ? String(row[emailCol] ?? '').trim() : '';
      const dateStr = dateCol ? String(row[dateCol] ?? '').trim() : '';
      const source = sourceCol ? String(row[sourceCol] ?? '').trim() : '';
      const city = cityCol ? String(row[cityCol] ?? '').trim() : '';

      const normalizedPhone = normalizePhone(phone);
      const normalizedEmail = normalizeEmail(email);
      const inquiryDate = parseExcelDate(dateStr);

      let isValid = true;
      let invalidReason = '';

      if (!name) { isValid = false; invalidReason = 'Missing name'; }
      else if (!normalizedPhone) { isValid = false; invalidReason = 'Missing or invalid phone'; }
      else if (normalizedPhone.length < 10) { isValid = false; invalidReason = 'Phone too short'; }
      else if (dateStr && !inquiryDate) { isValid = false; invalidReason = 'Invalid date format'; }

      const sourceClassification = classifySource(source, campaigns);

      return {
        rowIndex: idx, name, phone, email, date: dateStr, source, city,
        normalizedPhone, normalizedEmail,
        category: 'green' as DupCategory, categoryReason: '',
        sourceClassification,
        campaignName: source, campaignId: null,
        inquiryDate, isValid, invalidReason,
      };
    });

    setValidated(rows);
    setStep(4);
  }

  // --- Step 4→5: Classify → Campaign Matching ---
  function runCampaignMatching() {
    // For paid imports: match source to campaigns
    // For organic imports: skip campaign matching
    // For other: still try to match if source looks like a campaign

    const groups = new Map<string, { raw: string; count: number }>();
    for (const row of validated) {
      if (!row.isValid) continue;
      if (row.sourceClassification === 'organic' && importType === 'organic') continue;
      const norm = normalizeCampaignName(row.source);
      if (!norm) continue;
      if (!groups.has(norm)) groups.set(norm, { raw: row.source, count: 0 });
      groups.get(norm)!.count++;
    }

    const resolutions: CampaignResolution[] = [];
    for (const [norm, info] of groups) {
      const exact = campaigns.find((c) => normalizeCampaignName(c.name) === norm);
      let possibleMatch: string | null = null;
      let possibleMatchId: string | null = null;
      if (!exact) {
        let bestSim = 0;
        for (const c of campaigns) {
          const sim = similarity(norm, c.name);
          if (sim > bestSim && sim >= 0.6 && sim < 1) {
            bestSim = sim;
            possibleMatch = c.name;
            possibleMatchId = c.id;
          }
        }
      }
      resolutions.push({
        rawName: info.raw, normalized: norm,
        matchedId: exact?.id ?? null, matchedName: exact?.name ?? null,
        possibleMatch, possibleMatchId,
        decision: exact ? 'matched' : null,
        newCampaignId: null, affectedCount: info.count,
      });
    }

    setCampaignResolutions(resolutions);
    setStep(5);
  }

  function setCampaignDecision(idx: number, decision: 'existing' | 'new' | 'unassigned', campaignId?: string) {
    setCampaignResolutions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], decision, newCampaignId: campaignId ?? null };
      return next;
    });
  }

  // Inline campaign creation
  const [creatingCampaignIdx, setCreatingCampaignIdx] = useState<number | null>(null);
  const [newCampaignForm, setNewCampaignForm] = useState<CampaignInsert>({
    name: '', type: 'Meta Lead Ads', platform: 'Meta',
    start_date: null, end_date: null, budget: null, description: null,
  });

  function openCampaignCreator(idx: number) {
    const res = campaignResolutions[idx];
    setNewCampaignForm({
      name: res.rawName, type: 'Meta Lead Ads', platform: 'Meta',
      start_date: null, end_date: null, budget: null,
      description: `Created from import: ${fileName}`,
    });
    setCreatingCampaignIdx(idx);
  }

  async function confirmCreateCampaign() {
    if (creatingCampaignIdx === null) return;
    try {
      const created = await createCampaign(newCampaignForm);
      setCampaignResolutions((prev) => {
        const next = [...prev];
        next[creatingCampaignIdx] = { ...next[creatingCampaignIdx], decision: 'new', newCampaignId: created.id };
        return next;
      });
      setCreatingCampaignIdx(null);
    } catch { /* keep open on failure */ }
  }

  async function resolveCampaignsAndContinue() {
    const updated = [...campaignResolutions];
    setCampaignResolutions(updated);

    const campaignMap = new Map<string, string | null>();
    for (const res of updated) {
      let id: string | null = null;
      if (res.decision === 'matched' && res.matchedId) id = res.matchedId;
      else if (res.decision === 'existing' && res.newCampaignId) id = res.newCampaignId;
      else if (res.decision === 'new' && res.newCampaignId) id = res.newCampaignId;
      campaignMap.set(res.normalized, id);
    }

    setValidated((prev) => prev.map((row) => ({
      ...row,
      campaignId: row.source ? campaignMap.get(normalizeCampaignName(row.source)) ?? null : null,
    })));

    setStep(6);
  }

  // --- Step 6: Duplicate Detection ---
  async function runDuplicateCheck() {
    setImporting(true);
    try {
      const [bankPhones, leadPhones] = await Promise.all([fetchAllLeadBankPhones(), fetchAllLeadsPhones()]);
      const seenInFile = new Map<string, number>();

      const updated = validated.map((row) => {
        if (!row.isValid) return row;
        const key = row.normalizedPhone;
        const prevIdx = seenInFile.get(key);
        if (prevIdx !== undefined) {
          return { ...row, category: 'red' as DupCategory, categoryReason: 'Duplicate within same file' };
        }
        seenInFile.set(key, row.rowIndex);
        if (leadPhones.has(key)) {
          return { ...row, category: 'blue' as DupCategory, categoryReason: 'Already in CRM Leads' };
        }
        if (bankPhones.has(key)) {
          return { ...row, category: 'yellow' as DupCategory, categoryReason: 'Already in Lead Bank' };
        }
        return { ...row, category: 'green' as DupCategory, categoryReason: 'New lead' };
      });

      setValidated(updated);
      setStep(7);
    } finally {
      setImporting(false);
    }
  }

  // --- Step 7: Preview ---
  const previewStats = useMemo(() => {
    const newRows = validated.filter((r) => r.isValid && r.category === 'green').length;
    const inBank = validated.filter((r) => r.isValid && r.category === 'yellow').length;
    const inCrm = validated.filter((r) => r.isValid && r.category === 'blue').length;
    const conflicts = validated.filter((r) => r.isValid && r.category === 'red').length;
    const invalid = validated.filter((r) => !r.isValid).length;
    const unresolved = campaignResolutions.filter((r) => r.decision === null).length;
    return { newRows, inBank, inCrm, conflicts, invalid, unresolved };
  }, [validated, campaignResolutions]);

  const filteredPreview = useMemo(() => {
    switch (previewFilter) {
      case 'valid': return validated.filter((r) => r.isValid && r.category === 'green');
      case 'errors': return validated.filter((r) => !r.isValid);
      case 'duplicates': return validated.filter((r) => r.isValid && r.category !== 'green');
      case 'unmatched': return validated.filter((r) => r.isValid && r.sourceClassification === 'unclassified' && r.source);
      default: return validated;
    }
  }, [validated, previewFilter]);

  // --- Step 8: Import ---
  async function runImport() {
    setImporting(true);
    setImportProgress(0);
    setImportFatalError(null);
    const errors: string[] = [];
    let imported = 0, skippedDup = 0, skippedInvalid = 0, skippedConflict = 0;

    const rowsToInsert = validated.filter((r) => r.isValid && r.category === 'green');
    const totalBatch = rowsToInsert.length;

    const insertData = rowsToInsert.map((r) => ({
      name: r.name,
      phone: r.phone,
      email: r.email || null,
      city: r.city || null,
      source: r.source || null,
      campaign_id: r.campaignId,
      status: 'New' as const,
      // 'New' is the default LeadBankStatus for unqualified leads
      notes: null,
      last_contacted_at: null,
      inquiry_date: r.inquiryDate,
      original_source: r.source || null,
    }));

    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
        const batch = insertData.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseInsertLeadBank(batch);
        if (error) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error}`);
        } else {
          imported += batch.length;
        }
        setImportProgress(Math.round((Math.min(i + BATCH_SIZE, insertData.length) / totalBatch) * 100));
      }

      skippedDup = validated.filter((r) => r.isValid && (r.category === 'yellow' || r.category === 'blue')).length;
      skippedConflict = validated.filter((r) => r.isValid && r.category === 'red').length;
      skippedInvalid = validated.filter((r) => !r.isValid).length;

      const campaignsCreated = campaignResolutions.filter((r) => r.decision === 'new' && r.newCampaignId).length;

      try {
        await createLeadImportRecord({
          file_name: fileName,
          import_type: importTypeLabel(importType!),
          total_rows: validated.length,
          new_rows: imported,
          duplicate_rows: skippedDup,
          invalid_rows: skippedInvalid,
          conflict_rows: skippedConflict,
          campaigns_created: campaignsCreated,
          completed_at: new Date().toISOString(),
        });
      } catch {
        errors.push('Failed to save import history record');
      }

      setImportResult({ imported, skippedDup, skippedInvalid, skippedConflict, campaignsCreated, errors });
      setStep(9);
      onImported();
    } catch (e) {
      setImportFatalError(e instanceof Error ? e.message : 'Import failed due to a network or server error. You can retry — rows already imported were not duplicated.');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep(1); setImportType(null); setFileName(''); setRawRows([]);
    setHeaders([]); setColumnMap({}); setValidated([]); setCampaignResolutions([]);
    setImportResult(null); setImportProgress(0); setParseError('');
    setPreviewFilter('all'); setCreatingCampaignIdx(null); setImportFatalError(null);
  }

  async function loadHistory() {
    try {
      const data = await fetchLeadImports();
      setHistory(data);
      setShowHistory(true);
    } catch { /* ignore */ }
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Lead Import</h1>
          <p className="text-[13px] text-gray-400">Import leads from Excel or CSV into the Lead Bank for qualification.</p>
        </div>
        <button
          onClick={loadHistory}
          className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 card-shadow transition hover:bg-gray-50"
        >
          <History className="h-4 w-4" /> Import History
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <div className={'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ' + (step === s.id ? 'brand-gradient text-white shadow-sm' : step > s.id ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400')}>
              <span>{step > s.id ? <Check className="h-3 w-3" /> : s.id}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-black/5 bg-white card-shadow p-5 sm:p-6">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Upload your file</h2>
            <p className="text-[13px] text-gray-500">Supports .xlsx, .xls, and .csv files. The file is parsed in your browser — nothing is uploaded externally.</p>
            {parseError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {parseError}
              </div>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 transition hover:border-emerald-300 hover:bg-emerald-50/30"
            >
              <Upload className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-semibold text-gray-700">Click to select a file</p>
              <p className="text-[12px] text-gray-400">.xlsx, .xls, or .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Detect Columns */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Detected columns</h2>
            <p className="text-[13px] text-gray-500">We found {headers.length} columns in <span className="font-semibold">{fileName}</span>. Here's what we detected. You can fix any mappings in the next step.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['name', 'phone', 'email', 'date', 'source', 'city'] as const).map((field) => (
                <div key={field} className="rounded-xl border border-black/5 bg-gray-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{field}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {columnMap[field] ? (
                      <><Check className="h-4 w-4 text-emerald-500" /><span className="font-semibold text-gray-900">{columnMap[field]}</span></>
                    ) : (
                      <><X className="h-4 w-4 text-gray-300" /><span className="text-gray-400">Not detected</span></>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
              <button onClick={() => setStep(3)} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Continue <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Step 3: Map Columns */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Map columns</h2>
            <p className="text-[13px] text-gray-500">Match each field to the correct column in your file. Required: Name and Phone.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['name', 'phone', 'email', 'date', 'source', 'city'] as const).map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-500">{field === 'name' ? 'Name *' : field === 'phone' ? 'Phone *' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <select
                    value={columnMap[field] ?? ''}
                    onChange={(e) => setColumnMap((prev) => ({ ...prev, [field]: e.target.value || null }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
                  >
                    <option value="">— None —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
              <button
                onClick={runValidation}
                disabled={!columnMap.name || !columnMap.phone}
                className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                Validate Data <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Source Classification */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Source classification</h2>
            <p className="text-[13px] text-gray-500">We've classified each lead's source as Organic or Paid / Campaign based on existing campaigns and known organic sources.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ClassBox label="Organic" value={validated.filter((r) => r.sourceClassification === 'organic').length} color="bg-emerald-500" desc="Website, Referral, Inbound Call, etc." />
              <ClassBox label="Paid / Campaign" value={validated.filter((r) => r.sourceClassification === 'paid').length} color="bg-orange-500" desc="Source matches an existing campaign" />
              <ClassBox label="Unclassified" value={validated.filter((r) => r.sourceClassification === 'unclassified').length} color="bg-gray-400" desc="No automatic match — will need manual mapping" />
            </div>
            {validated.filter((r) => r.sourceClassification === 'unclassified' && r.source).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Unclassified sources detected</div>
                <p className="mt-1 text-[12px] text-amber-600">The following sources could not be automatically classified. You can map them to campaigns in the next step, or leave them unassigned.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from(new Set(validated.filter((r) => r.sourceClassification === 'unclassified' && r.source).map((r) => r.source))).slice(0, 10).map((s, i) => (
                    <span key={i} className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
              <button onClick={runCampaignMatching} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Match Campaigns <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Step 5: Campaign Matching */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Match campaigns</h2>
            <p className="text-[13px] text-gray-500">For each unique source value, assign to an existing campaign, create a new one, or keep unassigned. Exact matches are already assigned.</p>
            {campaignResolutions.length === 0 ? (
              <p className="text-[13px] text-gray-500">No source values found to match. Click continue to proceed.</p>
            ) : (
              <div className="space-y-3">
                {campaignResolutions.map((res, idx) => (
                  <div key={idx} className="rounded-xl border border-black/5 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{res.rawName}</div>
                        <div className="text-[12px] text-gray-400">{res.affectedCount} leads</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {res.decision === 'matched' && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Exact Match: {res.matchedName}</span>
                        )}
                        {res.possibleMatch && res.decision !== 'matched' && (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">Possible: {res.possibleMatch}</span>
                        )}
                      </div>
                    </div>
                    {res.decision !== 'matched' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {res.possibleMatchId && (
                          <button onClick={() => setCampaignDecision(idx, 'existing', res.possibleMatchId!)} className={'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ' + (res.decision === 'existing' ? 'brand-gradient text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>Use: {res.possibleMatch}</button>
                        )}
                        <button onClick={() => openCampaignCreator(idx)} className={'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ' + (res.decision === 'new' ? 'brand-gradient text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>Create New Campaign</button>
                        {/* Assign to any existing campaign */}
                        <div className="relative">
                          <select
                            value={res.decision === 'existing' ? (res.newCampaignId ?? '') : ''}
                            onChange={(e) => e.target.value && setCampaignDecision(idx, 'existing', e.target.value)}
                            className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-7 text-[12px] font-semibold text-gray-600 outline-none focus:border-emerald-300"
                          >
                            <option value="">Assign to…</option>
                            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <button onClick={() => setCampaignDecision(idx, 'unassigned')} className={'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ' + (res.decision === 'unassigned' ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')}>Keep Unassigned</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(4)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
              <button onClick={resolveCampaignsAndContinue} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Review Duplicates <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Step 6: Duplicate Review */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Duplicate detection</h2>
            {importing ? (
              <div className="flex items-center gap-3 py-8 text-gray-500"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> Checking Lead Bank and CRM Leads for duplicates…</div>
            ) : (
              <DuplicateSummary validated={validated} />
            )}
            {!importing && (
              <div className="flex justify-between">
                <button onClick={() => setStep(5)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
                <button onClick={runDuplicateCheck} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Check Duplicates <ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
            {!importing && validated.some((r) => r.category !== 'green' && r.isValid) && (
              <div className="flex justify-end">
                <button onClick={() => setStep(7)} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Preview Import <ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
            {!importing && validated.every((r) => !r.isValid || r.category === 'green') && (
              <div className="flex justify-end">
                <button onClick={() => setStep(7)} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95">Preview Import <ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Preview */}
        {step === 7 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Import preview</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatBox label="Total Rows" value={validated.length} tint="text-gray-700 bg-gray-100" />
              <StatBox label="New (Green)" value={previewStats.newRows} tint="text-emerald-700 bg-emerald-50" />
              <StatBox label="In Lead Bank (Yellow)" value={previewStats.inBank} tint="text-amber-700 bg-amber-50" />
              <StatBox label="In CRM (Blue)" value={previewStats.inCrm} tint="text-blue-700 bg-blue-50" />
              <StatBox label="Conflicts (Red)" value={previewStats.conflicts} tint="text-red-700 bg-red-50" />
              <StatBox label="Invalid" value={previewStats.invalid} tint="text-gray-500 bg-gray-100" />
            </div>

            {campaignResolutions.length > 0 && (
              <div className="rounded-xl border border-black/5 bg-gray-50 p-4">
                <p className="mb-2 text-[12px] font-semibold text-gray-500">Campaign Matching:</p>
                {campaignResolutions.map((res, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[13px]">
                    <span className="font-medium text-gray-700">{res.rawName}</span>
                    <span className="text-gray-400">{res.affectedCount} leads · {res.decision === 'matched' ? 'Exact Match' : res.decision === 'new' ? 'New Campaign' : res.decision === 'existing' ? 'Assigned' : 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'all' as const, label: 'All', count: validated.length },
                { id: 'valid' as const, label: 'Valid', count: previewStats.newRows },
                { id: 'errors' as const, label: 'Errors', count: previewStats.invalid },
                { id: 'duplicates' as const, label: 'Duplicates', count: previewStats.inBank + previewStats.inCrm + previewStats.conflicts },
                { id: 'unmatched' as const, label: 'Unmatched', count: previewStats.unresolved },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPreviewFilter(tab.id)}
                  className={'rounded-full px-3 py-1.5 text-[12px] font-semibold transition ' + (previewFilter === tab.id ? 'brand-gradient text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Preview table */}
            <div className="max-h-80 overflow-auto rounded-xl border border-black/5">
              <table className="w-full min-w-[600px]">
                <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Campaign</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreview.slice(0, 100).map((r) => (
                    <tr key={r.rowIndex} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-[11px] text-gray-400">{r.rowIndex + 2}</td>
                      <td className="px-3 py-2 text-[12px] font-medium text-gray-900">{r.name || <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-600">{r.phone}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-500">{r.source || '—'}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-500">
                        {r.campaignId ? campaigns.find((c) => c.id === r.campaignId)?.name ?? 'Assigned' : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {!r.isValid ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">{r.invalidReason}</span>
                        ) : r.category === 'green' ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">New</span>
                        ) : r.category === 'yellow' ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">In Bank</span>
                        ) : r.category === 'blue' ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">In CRM</span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Conflict</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPreview.length > 100 && <p className="py-2 text-center text-[11px] text-gray-400">Showing first 100 of {filteredPreview.length} rows</p>}
            </div>

            <p className="text-[13px] text-gray-500">Only <span className="font-semibold text-emerald-700">green (new)</span> rows will be imported into the Lead Bank. All others will be skipped.</p>
            {importFatalError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {importFatalError}
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(6)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /> Back</button>
              <button onClick={runImport} disabled={importing || previewStats.newRows === 0} className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? 'Importing…' : importFatalError ? 'Retry Import' : `Import ${previewStats.newRows} Leads`}
              </button>
            </div>
            {importing && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full brand-gradient transition-all" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="text-center text-[12px] text-gray-500">{importProgress}%</p>
              </div>
            )}
          </div>
        )}

        {/* Step 8: Importing (inline in step 7) */}
        {step === 8 && null}

        {/* Step 9: Result */}
        {step === 9 && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100"><Check className="h-6 w-6 text-emerald-600" /></div>
              <div>
                <h2 className="font-display text-lg font-bold text-gray-900">Import complete</h2>
                <p className="text-[13px] text-gray-400">{fileName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatBox label="Imported" value={importResult.imported} tint="text-emerald-700 bg-emerald-50" />
              <StatBox label="Skipped (Duplicate)" value={importResult.skippedDup} tint="text-amber-700 bg-amber-50" />
              <StatBox label="Skipped (Invalid)" value={importResult.skippedInvalid} tint="text-red-700 bg-red-50" />
              <StatBox label="Skipped (Conflict)" value={importResult.skippedConflict} tint="text-red-700 bg-red-50" />
              <StatBox label="Campaigns Created" value={importResult.campaignsCreated} tint="text-blue-700 bg-blue-50" />
              <StatBox label="Total Rows" value={validated.length} tint="text-gray-700 bg-gray-100" />
            </div>
            {importResult.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-[12px] font-semibold text-red-600">Errors:</p>
                {importResult.errors.map((e, i) => <p key={i} className="text-[12px] text-red-600">{e}</p>)}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={reset} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200"><RefreshCw className="h-4 w-4" /> New Import</button>
              <a href="#/leadbank" className="flex items-center gap-1.5 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95">Go to Lead Bank <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
        )}
      </div>

      {/* Campaign creation modal */}
      {creatingCampaignIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCreatingCampaignIdx(null)}>
          <div className="max-h-[90vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-gray-900">Create New Campaign</h3>
              <button onClick={() => setCreatingCampaignIdx(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">Campaign Name</label>
                <input value={newCampaignForm.name} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, name: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-500">Type</label>
                  <select value={newCampaignForm.type} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, type: e.target.value as CampaignType })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300">
                    {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-500">Platform</label>
                  <select value={newCampaignForm.platform ?? ''} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, platform: (e.target.value || null) as CampaignPlatform | null })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300">
                    <option value="">—</option>
                    {CAMPAIGN_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-500">Start Date</label>
                  <input type="date" value={newCampaignForm.start_date ?? ''} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, start_date: e.target.value || null })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-500">End Date</label>
                  <input type="date" value={newCampaignForm.end_date ?? ''} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, end_date: e.target.value || null })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">Budget (₹)</label>
                <input type="number" value={newCampaignForm.budget ?? ''} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, budget: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">Description</label>
                <textarea value={newCampaignForm.description ?? ''} onChange={(e) => setNewCampaignForm({ ...newCampaignForm, description: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setCreatingCampaignIdx(null)} className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200">Cancel</button>
              <button onClick={confirmCreateCampaign} disabled={!newCampaignForm.name.trim()} className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50">
                <Check className="h-4 w-4" /> Create & Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowHistory(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-gray-900">Import History</h3>
              <button onClick={() => setShowHistory(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No imports yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-black/5 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">{h.file_name}</span>
                      </div>
                      <span className="text-[11px] text-gray-400">{new Date(h.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{h.import_type}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{h.new_rows} new</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{h.duplicate_rows} dup</span>
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{h.invalid_rows} invalid</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">{h.total_rows} total</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function StatBox({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3">
      <div className={'mb-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold ' + tint}>{label}</div>
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ClassBox({ label, value, color, desc }: { label: string; value: number; color: string; desc: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4">
      <div className={'mb-2 h-2.5 w-2.5 rounded-full ' + color} />
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
      <div className="text-[12px] font-semibold text-gray-700">{label}</div>
      <div className="text-[11px] text-gray-400">{desc}</div>
    </div>
  );
}

function DuplicateSummary({ validated }: { validated: ValidatedRow[] }) {
  const stats = {
    green: validated.filter((r) => r.isValid && r.category === 'green').length,
    yellow: validated.filter((r) => r.isValid && r.category === 'yellow').length,
    blue: validated.filter((r) => r.isValid && r.category === 'blue').length,
    red: validated.filter((r) => r.isValid && r.category === 'red').length,
    invalid: validated.filter((r) => !r.isValid).length,
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <DupBox label="New" value={stats.green} color="bg-emerald-500" />
        <DupBox label="In Lead Bank" value={stats.yellow} color="bg-amber-400" />
        <DupBox label="In CRM" value={stats.blue} color="bg-blue-500" />
        <DupBox label="Conflict" value={stats.red} color="bg-red-500" />
        <DupBox label="Invalid" value={stats.invalid} color="bg-gray-400" />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Duplicate Detection</div>
        <p className="mt-1 text-[12px] text-amber-600">Phone numbers are normalized (removing +91, spaces, dashes) before matching. Only new (green) rows will be imported. Existing records will be skipped to prevent duplicates.</p>
      </div>
    </div>
  );
}

function DupBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3 text-center">
      <div className={'mx-auto mb-1.5 h-2.5 w-2.5 rounded-full ' + color} />
      <div className="font-display text-xl font-bold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-400">{label}</div>
    </div>
  );
}

async function supabaseInsertLeadBank(rows: Record<string, unknown>[]): Promise<{ error: string | null }> {
  assertWritable();
  const { error } = await supabase.from('lead_bank').insert(rows);
  return { error: error?.message ?? null };
}
