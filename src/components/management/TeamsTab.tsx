import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { addTeam, updateTeam, getEligibleTeamLeaders } from '../../services/teamService';
import { getTeamsForUser } from '../../services/teamScopeService';
import { Card } from '../ui/Card';
import type { Team, TeamManualMember } from '../../types';
import styles from './ManagementTabs.module.css';

const emptyManualMember: TeamManualMember = { fullName: '', phoneNumber: '', role: '' };

const defaultForm = {
  code: '',
  description: '',
  percentage: 70,
  leaderId: '',
  membersManual: [] as TeamManualMember[],
  vehicleId: '',
};

export function TeamsTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const navigate = useNavigate();
  const companyId = user?.companyId ?? '';
  const teams = getTeamsForUser(companyId, user);
  const users = store.getUsers(companyId);
  const eligibleLeaders = getEligibleTeamLeaders(companyId);
  const vehicles = store.getVehicles(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saveError, setSaveError] = useState('');

  const canApproveTeam = user?.role === 'companyManager' || user?.role === 'projectManager';
  const needsApproval = user?.role === 'teamLeader';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    const membersManual = form.membersManual.filter((m) => m.fullName.trim() || m.phoneNumber.trim());
    if (editing) {
      const result = updateTeam(user ?? undefined, editing.id, {
        code: form.code,
        description: form.description,
        percentage: form.percentage,
        leaderId: form.leaderId || undefined,
        membersManual,
        vehicleId: form.vehicleId || undefined,
      });
      if (!result.ok) {
        setSaveError(t(result.error));
        return;
      }
      setEditing(null);
    } else {
      const result = addTeam(user ?? undefined, {
        companyId,
        code: form.code,
        description: form.description,
        percentage: form.percentage,
        createdBy: user!.id,
        approvalStatus: needsApproval ? 'pending' : 'approved',
        approvedBy: needsApproval ? undefined : user!.id,
        leaderId: form.leaderId || undefined,
        memberIds: [],
        membersManual,
        vehicleId: form.vehicleId || undefined,
      });
      if (!result.ok) {
        setSaveError(t(result.error));
        return;
      }
      setShowForm(false);
    }
    setForm(defaultForm);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setForm({
      code: team.code,
      description: team.description ?? '',
      percentage: team.percentage,
      leaderId: team.leaderId ?? '',
      membersManual: team.membersManual ?? [],
      vehicleId: team.vehicleId ?? '',
    });
  };

  const handleApprove = (teamId: string) => {
    store.updateTeam(teamId, { approvalStatus: 'approved', approvedBy: user!.id });
  };

  const handleReject = (teamId: string) => {
    store.updateTeam(teamId, { approvalStatus: 'rejected' });
  };

  const creatorName = (userId: string) => users.find((u) => u.id === userId)?.fullName ?? userId;
  const leaderName = (userId: string) => users.find((u) => u.id === userId)?.fullName ?? '–';
  const vehicleLabel = (id: string) => {
    const v = store.getVehicle(id);
    return v ? `${v.plateNumber} (${v.brand} ${v.model})` : '–';
  };

  const addManualMember = () => {
    setForm((f) => ({ ...f, membersManual: [...f.membersManual, { ...emptyManualMember }] }));
  };
  const updateManualMember = (index: number, field: keyof TeamManualMember, value: string) => {
    setForm((f) => {
      const next = [...f.membersManual];
      next[index] = { ...next[index], [field]: value };
      return { ...f, membersManual: next };
    });
  };
  const removeManualMember = (index: number) => {
    setForm((f) => ({ ...f, membersManual: f.membersManual.filter((_, i) => i !== index) }));
  };

  return (
    <>
      <Card>
        <div className={styles.toolbar}>
          <h3 className={styles.sectionTitle}>{t('teams.title')}</h3>
          {!showForm && !editing && (
            <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(true)}>
              {t('teams.createTeam')}
            </button>
          )}
        </div>

        {(showForm || editing) && (
          <form onSubmit={handleSave} className={styles.form}>
            <label className={styles.label}>
              {t('teams.teamCode')}
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className={styles.input}
                required
              />
            </label>
            <label className={styles.label}>
              {t('teams.description')}
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={styles.input}
                rows={2}
              />
            </label>
            <label className={styles.label}>
              {t('teams.percentage')} (%)
              <input
                type="number"
                min={1}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm((f) => ({ ...f, percentage: Number(e.target.value) || 0 }))}
                className={styles.input}
                placeholder={t('teams.percentagePlaceholder')}
              />
            </label>
            <label className={styles.label}>
              {t('teams.leader')}
              <select
                value={form.leaderId}
                onChange={(e) => setForm((f) => ({ ...f, leaderId: e.target.value }))}
                className={styles.input}
              >
                <option value="">– {t('teams.selectLeader')} –</option>
                {eligibleLeaders.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              {eligibleLeaders.length === 0 && <p className={styles.muted}>{t('teams.noEligibleLeaders')}</p>}
            </label>
            {saveError && <p className={styles.saveError}>{saveError}</p>}
            <label className={styles.label}>{t('teams.membersManual')}</label>
            <div className={styles.memberCards}>
              {form.membersManual.map((m, index) => (
                <div key={index} className={styles.memberCard}>
                  <input
                    type="text"
                    placeholder={t('auth.fullName')}
                    value={m.fullName}
                    onChange={(e) => updateManualMember(index, 'fullName', e.target.value)}
                    className={styles.input}
                  />
                  <input
                    type="text"
                    placeholder={t('teams.phoneNumber')}
                    value={m.phoneNumber}
                    onChange={(e) => updateManualMember(index, 'phoneNumber', e.target.value)}
                    className={styles.input}
                  />
                  <input
                    type="text"
                    placeholder={t('teams.roleTitle')}
                    value={m.role ?? ''}
                    onChange={(e) => updateManualMember(index, 'role', e.target.value)}
                    className={styles.input}
                  />
                  <button type="button" className={styles.removeMemberBtn} onClick={() => removeManualMember(index)} aria-label={t('teams.removeMember')}>
                    {t('teams.removeMember')}
                  </button>
                </div>
              ))}
              <button type="button" className={styles.addMemberBtn} onClick={addManualMember}>
                {t('teams.addMember')}
              </button>
            </div>
            <label className={styles.label}>
              {t('teams.vehicle')}
              <select
                value={form.vehicleId}
                onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                className={styles.input}
              >
                <option value="">– {t('teams.selectVehicle')} –</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plateNumber} – {v.brand} {v.model}</option>
                ))}
              </select>
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => { setShowForm(false); setEditing(null); setForm(defaultForm); }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('teams.teamCode')}</th>
              <th>{t('teams.description')}</th>
              <th>{t('teams.percentage')}</th>
              <th>{t('teams.leader')}</th>
              <th>{t('teams.vehicle')}</th>
              <th>{t('teams.createdBy')}</th>
              <th>{t('jobs.status')}</th>
              {canApproveTeam && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className={styles.clickableRow} onClick={() => navigate(`/team/${team.id}`)}>
                <td><button type="button" className={styles.linkBtn}>{team.code}</button></td>
                <td>{team.description ?? '–'}</td>
                <td>{team.percentage}%</td>
                <td>{team.leaderId ? leaderName(team.leaderId) : '–'}</td>
                <td>{team.vehicleId ? vehicleLabel(team.vehicleId) : '–'}</td>
                <td>{creatorName(team.createdBy)}</td>
                <td>
                  {team.approvalStatus === 'pending' && (
                    <span className={styles.badgePending}>{t('teams.pendingApproval')}</span>
                  )}
                  {team.approvalStatus === 'approved' && (
                    <span className={styles.badgeOk}>{t('jobs.approved')}</span>
                  )}
                  {team.approvalStatus === 'rejected' && (
                    <span className={styles.badgeReject}>{t('jobs.rejected')}</span>
                  )}
                </td>
                {canApproveTeam && team.approvalStatus === 'pending' && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={styles.smallBtnOk} onClick={() => handleApprove(team.id)}>{t('teams.approve')}</button>
                    <button type="button" className={styles.smallBtnDanger} onClick={() => handleReject(team.id)}>{t('teams.reject')}</button>
                  </td>
                )}
                {canApproveTeam && team.approvalStatus !== 'pending' && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={styles.smallBtnEdit} onClick={(e) => { e.stopPropagation(); openEdit(team); }}>{t('common.edit')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {teams.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>
    </>
  );
}
