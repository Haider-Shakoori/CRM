'use client';

import * as React from 'react';
import type { AiConversation, AiMessage } from '@crm/shared-types';
import {
  Alert,
  Button,
  Card,
  DemoNotice,
  Input,
  Textarea,
  cn,
  notify,
} from '@crm/ui';
import {
  FilterBar,
  PageHeader,
  formatDate,
} from '../../components/shared';
import { useList, useServices } from '../../app/ServiceProvider';

export default function AiWorkspace() {
  const services = useServices();
  const [search, setSearch] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [conversation, setConversation] = React.useState<AiConversation | null>(null);
  const [messages, setMessages] = React.useState<AiMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [emailDraft, setEmailDraft] = React.useState('');
  const [reviewed, setReviewed] = React.useState(false);

  const conversations = useList(
    () => services.ai.conversations({ pageSize: 100, q: search || undefined }),
    [search]
  );

  const createConversation = async () => {
    const result = await services.ai.createConversation({ entryPoint: 'assistant_home' });
    if (result.ok) {
      setConversation(result.data);
      setMessages(result.data.messages || []);
    }
  };

  const sendMessage = async () => {
    if (!conversation || !prompt.trim()) return;
    setLoading(true);
    const result = await services.ai.send(conversation.id, prompt, 'general_assistant');
    setLoading(false);
    if (result.ok) {
      setPrompt('');
      // `send` returns the assistant turn; re-read the conversation so the user's own
      // message appears in the thread rather than being silently dropped.
      const refreshed = await services.ai.conversation(conversation.id);
      if (refreshed.ok) {
        setMessages(refreshed.data.messages ?? [result.data]);
      } else {
        setMessages((prev) => [...prev, result.data]);
      }
      if (result.data.draft?.kind === 'email') {
        setEmailDraft(result.data.draft.body);
        setReviewed(false);
      } else {
        setEmailDraft('');
      }
    } else {
      notify.error(result.error.message);
    }
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="AI assistant"
        description="Summaries with citations, email drafting with explicit review, lead scoring explanation, forecast commentary, natural-language report builder. (Demo only — deterministic, no real AI.)"
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'AI' }, { label: 'Assistant' }]}
        sample
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search conversations"
        resultCount={conversations.meta ? `${conversations.meta.total.toLocaleString()} conversations` : undefined}
        actions={<Button size="sm" onClick={createConversation}>New conversation</Button>}
      />
      <div className="grid grid-cols-12 gap-4 p-4 sm:p-6">
        <div className="col-span-12 md:col-span-4 space-y-3">
          <Card className="p-3">
            <h2 className="text-sm font-semibold mb-2">Conversations</h2>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {conversations.items.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setConversation(c);
                    setMessages(c.messages || []);
                  }}
                  className={cn(
                    'w-full text-left p-2 rounded border text-xs',
                    conversation?.id === c.id ? 'border-brand bg-brand-subtle' : 'border-border-subtle hover:bg-hover'
                  )}
                >
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-subtle">{formatDate(c.updatedAt)}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-8 space-y-3">
          <DemoNotice tone="warning">
            Deterministic demo engine. Every output is labelled as demo and cites source records where applicable. No model called, no data leaves browser.
          </DemoNotice>
          <Card className="p-4">
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {messages.map((m) => (
                <div key={m.id} className={cn('text-xs', m.role === 'user' ? 'text-right' : 'text-left')}>
                  <div className={cn('inline-block p-2 rounded max-w-[80%]', m.role === 'user' ? 'bg-brand-subtle' : 'bg-inset')}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.origin === 'demo_template_engine' && (
                      <div className="text-[10px] text-subtle mt-1">[Demo: deterministic composition]</div>
                    )}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 text-[10px] text-subtle">
                        Citations:
                        {m.citations.map((c, i) => (
                          <span key={i}> {c.label}{i < m.citations!.length - 1 ? ',' : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="text-xs text-subtle">Thinking...</div>}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask for summary, draft email, lead scoring explanation, forecast commentary, or report builder..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              />
              <Button onClick={sendMessage} disabled={loading || !conversation}>Send</Button>
            </div>
          </Card>

          {emailDraft && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold mb-2">Email draft — must be reviewed before anything happens</h2>
              <Alert tone="warning" title="Nothing is sent">
                This is a draft only. Nothing is transmitted. You must review and explicitly act to send (not implemented in demo).
              </Alert>
              <Textarea
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="mt-3 min-h-[120px]"
              />
              <label className="flex items-center gap-2 mt-2 text-xs">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                I have reviewed this draft. (Demo only — no send action.)
              </label>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
