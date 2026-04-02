import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserPlus, Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamView() {
  const [members, setMembers] = useState<{id: string, name: string, role: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Membro');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('team_members').select('*').order('name');
    if (!error && data) {
      setMembers(data);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newMember = { id: crypto.randomUUID(), name: newName, role: newRole };
    
    // update optimistic
    setMembers(prev => [...prev, newMember]);
    setNewName('');

    const { error } = await supabase.from('team_members').insert(newMember);
    if (error) {
      toast.error('Erro ao adicionar membro: Crie a tabela team_members primeiro.');
      fetchMembers(); // revert
    } else {
      toast.success('Membro adicionado!');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover membro da equipe?')) return;
    setMembers(prev => prev.filter(m => m.id !== id));
    await supabase.from('team_members').delete().eq('id', id);
    toast.success('Removido com sucesso.');
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditRole(m.role || 'Membro');
  };

  const saveEdit = async (id: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name: editName, role: editRole } : m));
    setEditingId(null);
    await supabase.from('team_members').update({ name: editName, role: editRole }).eq('id', id);
    toast.success('Atualizado!');
  };

  if (loading) return <div className="p-8">Carregando equipe...</div>;

  return (
    <div className="flex-1 bg-[#F5F6F8] min-h-screen overflow-y-auto w-full p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#323338]">Gestão da Equipe</h1>
            <p className="text-slate-500 text-sm">Cadastre e gerencie os funcionários e responsáveis pelas tarefas.</p>
          </div>
        </div>

        {/* Adicionar Novo */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Adicionar Novo Integrante
          </h2>
          <form onSubmit={handleAdd} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nome Completo</label>
              <input 
                type="text" 
                autoFocus
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Função / Cargo</label>
              <input 
                type="text" 
                placeholder="Ex: Projetista 3D"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={!newName.trim()}
              className="bg-[#0073ea] hover:bg-[#0060c2] text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Adicionar
            </button>
          </form>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex-1">Nome</div>
            <div className="flex-1">Cargo</div>
            <div className="w-24 text-right">Ações</div>
          </div>

          {members.length === 0 ? (
            <div className="p-12 text-center text-slate-400">Nenhum integrante cadastrado.</div>
          ) : (
            <div className="divide-y">
              {members.map(member => (
                <div key={member.id} className="px-6 py-4 flex items-center hover:bg-slate-50 transition-colors">
                  {editingId === member.id ? (
                    <>
                      <div className="flex-1 pr-4">
                        <input className="w-full border rounded px-2 py-1" value={editName} onChange={e => setEditName(e.target.value)} />
                      </div>
                      <div className="flex-1 pr-4">
                        <input className="w-full border rounded px-2 py-1" value={editRole} onChange={e => setEditRole(e.target.value)} />
                      </div>
                      <div className="w-24 flex justify-end gap-2">
                        <button onClick={() => saveEdit(member.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 font-medium text-slate-700 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                        {member.name}
                      </div>
                      <div className="flex-1 text-slate-500 text-sm">{member.role || '—'}</div>
                      <div className="w-24 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(member)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(member.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
