import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthStatus } from '../components/AuthStatus';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { useAuthUser } from '../hooks/useAuthUser';
import {
  getEditableRegion,
  saveRegion,
  uploadRegionPdf,
  type RegionInput,
} from '../services/api/admin';
import type { Calibration, CalibrationPoint, ViewKind } from '../types/domain';

const defaultPoints: CalibrationPoint[] = [
  { realX: 0, realY: 0, pdfX: 0, pdfY: 0 },
  { realX: 1000, realY: 500, pdfX: 1000, pdfY: 500 },
];

const makeCalibration = (id: string, pdfId: string): Calibration => ({
  id,
  pdfId,
  points: defaultPoints,
  rotationDeg: 0,
});

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
      <input
        className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function CalibrationEditor({
  title,
  calibration,
  onChange,
}: {
  title: string;
  calibration: Calibration;
  onChange: (calibration: Calibration) => void;
}) {
  const updatePoint = (index: number, patch: Partial<CalibrationPoint>) => {
    onChange({
      ...calibration,
      points: calibration.points.map((point, currentIndex) =>
        currentIndex === index ? { ...point, ...patch } : point,
      ),
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Informe dois pontos conhecidos para converter coordenadas reais em coordenadas do PDF.
      </p>
      <div className="mt-4 grid gap-3">
        {calibration.points.map((point, index) => (
          <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4" key={index}>
            <NumberInput
              label={`P${index + 1} real X`}
              value={point.realX}
              onChange={(value) => updatePoint(index, { realX: value })}
            />
            <NumberInput
              label={`P${index + 1} real Y`}
              value={point.realY}
              onChange={(value) => updatePoint(index, { realY: value })}
            />
            <NumberInput
              label={`P${index + 1} PDF X`}
              value={point.pdfX}
              onChange={(value) => updatePoint(index, { pdfX: value })}
            />
            <NumberInput
              label={`P${index + 1} PDF Y`}
              value={point.pdfY}
              onChange={(value) => updatePoint(index, { pdfY: value })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { user, isReady } = useAuthUser();
  const adminProfile = useAdminProfile(user);
  const isAdmin = adminProfile.data?.role === 'admin';
  const [regionId, setRegionId] = useState('default');
  const regionQuery = useQuery({
    queryKey: ['admin-region', regionId],
    queryFn: () => getEditableRegion(regionId),
    enabled: isAdmin && regionId.trim().length > 0,
  });

  const [form, setForm] = useState<RegionInput>(() => ({
    id: 'default',
    name: 'P84/85 Hull - Demo',
    plantPdf: 'pdfs/planta-demo.pdf',
    sidePdf: 'pdfs/lateral-demo.pdf',
    plantCalibration: makeCalibration('default-plant', 'planta-demo'),
    sideCalibration: makeCalibration('default-side', 'lateral-demo'),
  }));

  useEffect(() => {
    if (!regionQuery.data) return;
    // The form is intentionally hydrated after Firestore returns the editable region.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      id: regionQuery.data.id,
      name: regionQuery.data.name,
      plantPdf: regionQuery.data.plantPdf,
      sidePdf: regionQuery.data.sidePdf,
      plantCalibration: regionQuery.data.plantCalibration,
      sideCalibration: regionQuery.data.sideCalibration,
    });
  }, [regionQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveRegion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-region', form.id] });
      void queryClient.invalidateQueries({ queryKey: ['selected-tag-context'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ view, file }: { view: ViewKind; file: File }) =>
      uploadRegionPdf(form.id, view, file),
    onSuccess: (path, variables) => {
      setForm((current) => ({
        ...current,
        [variables.view === 'plant' ? 'plantPdf' : 'sidePdf']: path,
      }));
    },
  });

  const status = useMemo(() => {
    if (!isReady) return 'Verificando autenticação...';
    if (!user) return 'Entre com Google para acessar a administração.';
    if (adminProfile.isLoading) return 'Verificando perfil de administrador...';
    if (!isAdmin) return 'Seu usuário não tem permissão de administrador.';
    if (uploadMutation.isPending) return 'Enviando PDF...';
    if (saveMutation.isPending) return 'Salvando região...';
    if (saveMutation.isSuccess) return 'Região salva.';
    return 'Administrador ativo.';
  }, [
    adminProfile.isLoading,
    isAdmin,
    isReady,
    saveMutation.isPending,
    saveMutation.isSuccess,
    uploadMutation.isPending,
    user,
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">
              Administração
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              PDFs, regiões e calibração
            </h1>
            <p className="mt-2 text-sm text-slate-500">{status}</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <AuthStatus user={user} isReady={isReady} />
            <Link className="text-sm font-semibold text-blue-600" to="/">
              Voltar para busca
            </Link>
          </div>
        </header>

        {isAdmin && (
          <>
            <section className="panel grid gap-4 md:grid-cols-[220px_1fr_1fr]">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                ID da região
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={regionId}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setRegionId(value);
                    setForm((current) => ({ ...current, id: value }));
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nome da região
                <input
                  className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <div className="flex items-end">
                <button
                  className="button-primary w-full"
                  type="button"
                  onClick={() => saveMutation.mutate(form)}
                >
                  Salvar região
                </button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {(['plant', 'side'] as const).map((view) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4" key={view}>
                  <h2 className="font-semibold text-slate-950">
                    PDF {view === 'plant' ? 'Planta' : 'Lateral'}
                  </h2>
                  <p className="mt-1 break-all text-sm text-slate-500">
                    {view === 'plant' ? form.plantPdf : form.sidePdf}
                  </p>
                  <input
                    className="mt-4 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadMutation.mutate({ view, file });
                    }}
                  />
                </div>
              ))}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <CalibrationEditor
                title="Calibração da planta"
                calibration={form.plantCalibration}
                onChange={(plantCalibration) =>
                  setForm((current) => ({ ...current, plantCalibration }))
                }
              />
              <CalibrationEditor
                title="Calibração da lateral"
                calibration={form.sideCalibration}
                onChange={(sideCalibration) =>
                  setForm((current) => ({ ...current, sideCalibration }))
                }
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
