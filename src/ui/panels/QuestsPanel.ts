// Quest journal (J): active / completed quests with progress and rewards.
import { Data } from '../../data';
import { questGoal } from '../../game/systems/QuestSystem';
import { el } from '../components/el';
import { registerPanel } from '../UIRoot';
import { panelFrame } from './common';

const STATUS: Record<string, string> = { active: 'Em andamento', complete: 'Concluída — fale com quem a deu', turnedIn: 'Entregue' };

registerPanel('quests', (ui, ctx) => {
  const body = el('div', { class: 'quest-log' });
  const root = panelFrame('Diário', 'Missões aceitas na cidade', () => ui.closePanel('quests'), body);
  const render = () => {
    const c = ctx.character;
    const entries = Data.quests.filter((q) => c.quests[q.id]);
    entries.sort((a, b) => (c.quests[a.id].status === 'turnedIn' ? 1 : 0) - (c.quests[b.id].status === 'turnedIn' ? 1 : 0));
    body.replaceChildren(
      ...(entries.length
        ? entries.map((q) => {
            const st = c.quests[q.id];
            const goal = questGoal(q);
            const giver = Data.npcs.find((n) => n.id === q.giver)?.name ?? '';
            const rewards = [q.reward.xp ? `${q.reward.xp} XP` : '', q.reward.gold ? `${q.reward.gold} ouro` : '', q.reward.item ? 'item' : '', q.reward.skillPoint ? '+1 ponto de habilidade' : ''].filter(Boolean).join(' · ');
            return el(
              'div',
              { class: `quest-entry quest-entry--${st.status}` },
              el('h4', q.name),
              el('p', q.description),
              goal > 1 && st.status === 'active' ? el('div', { class: 'paragon__bar' }, el('i', { style: `width:${Math.min(100, (st.progress / goal) * 100)}%` })) : null,
              el('p', { class: 'kv' }, `${STATUS[st.status] ?? st.status}${goal > 1 && st.status === 'active' ? ` (${st.progress}/${goal})` : ''}${giver ? ` · ${giver}` : ''}`),
              el('p', { class: 'kv' }, `Recompensa: ${rewards}`),
            );
          })
        : [el('p', { class: 'npc-greeting' }, 'Nenhuma missão ainda. Converse com os moradores de Brasaluz (ícone ! sobre a cabeça).')]),
    );
  };
  for (const e of ['questAccepted', 'questProgress', 'questCompleted'] as const) ctx.events.on(e, () => root.isConnected && render());
  return { el: root, side: 'left', onOpen: render };
});
