'use client';

import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, FileText, Layers, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { KbArticle, KbBlock } from '@crm/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DemoNotice,
  MiniStat,
  Pagination,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TonePill,
  cn,
} from '@crm/ui';
import { FilterBar, ListSkeleton, PageHeader, RecordHeader, formatDate, formatNumber } from '../../components/shared';
import { useAsync, useList, useMutation, useServices } from '../../app/ServiceProvider';

/**
 * Knowledge base screens.
 *
 * Articles are stored as structured blocks rather than raw HTML, so the reader below is a
 * closed switch over the block union — there is no `dangerouslySetInnerHTML` anywhere and no
 * sanitiser to get wrong. The Categories tab is derived from the loaded articles, because the
 * knowledge-base service exposes articles, not the category table.
 */

const VISIBILITY_LABEL: Record<string, string> = {
  organization: 'Organization',
  team: 'Team',
  public: 'Public',
  internal: 'Internal',
  both: 'Internal & public',
};

export default function KbList() {
  const services = useServices();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('articles');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [scopeFilter, setScopeFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  const filter = React.useMemo(() => {
    const clauses: Array<{ field: string; operator: 'eq'; value: unknown }> = [];
    if (statusFilter !== 'all') clauses.push({ field: 'status', operator: 'eq', value: statusFilter });
    if (scopeFilter !== 'all') clauses.push({ field: 'scope', operator: 'eq', value: scopeFilter });
    if (categoryFilter !== 'all') clauses.push({ field: 'categoryId', operator: 'eq', value: categoryFilter });
    return clauses.length > 0 ? { id: 'kb-filters', conjunction: 'and' as const, clauses } : undefined;
  }, [statusFilter, scopeFilter, categoryFilter]);

  const query = React.useMemo(
    () => ({ page, pageSize: 40, q: search || undefined, sort: [{ field: 'updatedAt', direction: 'desc' as const }], filter: filter as never }),
    [page, search, filter],
  );

  const articles = useList(() => services.knowledgeBase.list(query), [JSON.stringify(query)]);
  const allArticles = useList(() => services.knowledgeBase.list({ pageSize: 200 }), []);

  const categories = React.useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number; internal: boolean }>();
    for (const article of allArticles.items) {
      const entry = map.get(article.categoryId) ?? { id: article.categoryId, label: article.categoryLabel, count: 0, internal: article.scope === 'internal' };
      entry.count += 1;
      map.set(article.categoryId, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [allArticles.items]);

  const stats = React.useMemo(() => {
    const items = allArticles.items;
    const views = items.reduce((sum, article) => sum + article.views, 0);
    const helpful = items.reduce((sum, article) => sum + article.helpfulCount, 0);
    const notHelpful = items.reduce((sum, article) => sum + article.notHelpfulCount, 0);
    return {
      published: items.filter((article) => article.status === 'published').length,
      inReview: items.filter((article) => article.status === 'in_review').length,
      drafts: items.filter((article) => article.status === 'draft').length,
      views,
      helpfulRate: helpful + notHelpful > 0 ? Math.round((helpful / (helpful + notHelpful)) * 100) : 0,
    };
  }, [allArticles.items]);

  const columns = React.useMemo<ColumnDef<KbArticle, unknown>[]>(
    () => [
      {
        id: 'title',
        header: 'Article',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link to={`/app/knowledge-base/${row.original.id}`} className="block truncate text-xs font-medium text-fg hover:text-link hover:underline">
              {row.original.title}
            </Link>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">{row.original.summary}</span>
          </div>
        ),
      },
      { id: 'category', header: 'Category', accessorKey: 'categoryLabel', cell: ({ row }) => <span className="text-xs text-muted">{row.original.categoryLabel}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      {
        id: 'scope',
        header: 'Scope',
        accessorKey: 'scope',
        cell: ({ row }) => <Badge variant="outline" size="sm">{row.original.scope === 'public' ? 'Public' : 'Internal'}</Badge>,
      },
      {
        id: 'views',
        header: 'Views',
        accessorKey: 'views',
        meta: { align: 'end' },
        cell: ({ row }) => <span className="text-xs tabular-nums text-muted">{formatNumber(row.original.views)}</span>,
      },
      {
        id: 'helpful',
        header: 'Helpful',
        accessorFn: (article) => (article.helpfulCount + article.notHelpfulCount > 0 ? article.helpfulCount / (article.helpfulCount + article.notHelpfulCount) : 0),
        meta: { align: 'end' },
        cell: ({ row }) => {
          const total = row.original.helpfulCount + row.original.notHelpfulCount;
          const rate = total > 0 ? Math.round((row.original.helpfulCount / total) * 100) : 0;
          return <span className="text-xs tabular-nums text-muted">{total > 0 ? `${rate}%` : '—'}</span>;
        },
      },
      { id: 'updated', header: 'Updated', accessorKey: 'updatedAt', cell: ({ row }) => <span className="text-[0.6875rem] text-muted">{formatDate(row.original.updatedAt, 'relative')}</span> },
    ],
    [],
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Knowledge base"
        description="Internal and public articles written as structured blocks, with review dates and helpfulness voting."
        breadcrumbs={[{ label: 'Home', to: '/app/home' }, { label: 'Support', to: '/app/tickets' }, { label: 'Knowledge base' }]}
        tabs={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        footer={
          tab === 'articles' ? (
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search articles"
              resultCount={articles.meta ? `${articles.meta.total.toLocaleString()} articles` : undefined}
              chips={[
                ...(statusFilter !== 'all' ? [{ id: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, tone: 'brand' as const, onRemove: () => setStatusFilter('all') }] : []),
                ...(scopeFilter !== 'all' ? [{ id: 'scope', label: `Scope: ${scopeFilter}`, tone: 'brand' as const, onRemove: () => setScopeFilter('all') }] : []),
                ...(categoryFilter !== 'all' ? [{ id: 'category', label: `Category: ${categories.find((category) => category.id === categoryFilter)?.label ?? ''}`, tone: 'brand' as const, onRemove: () => setCategoryFilter('all') }] : []),
              ]}
              onClearFilters={() => {
                setStatusFilter('all');
                setScopeFilter('all');
                setCategoryFilter('all');
                setSearch('');
              }}
            />
          ) : undefined
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Published" value={formatNumber(stats.published)} tone="green" />
          <MiniStat label="In review" value={formatNumber(stats.inReview)} tone="amber" />
          <MiniStat label="Drafts" value={formatNumber(stats.drafts)} tone="slate" />
          <MiniStat label="Total views" value={formatNumber(stats.views, true)} tone="blue" />
          <MiniStat label="Helpful rate" value={`${stats.helpfulRate}%`} tone="teal" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="articles" className="space-y-4">
            {articles.loading ? (
              <ListSkeleton rows={10} columns={6} />
            ) : (
              <DataTable
                columns={columns}
                data={articles.items}
                onRowClick={(article) => navigate(`/app/knowledge-base/${article.id}`)}
                getRowId={(article) => article.id}
                footer={articles.meta ? <Pagination page={articles.meta.page} pageSize={articles.meta.pageSize} total={articles.meta.total} onPageChange={setPage} /> : null}
              />
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            {allArticles.loading ? (
              <ListSkeleton rows={5} columns={2} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <Card key={category.id} elevation="flat">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="truncate">{category.label}</CardTitle>
                        <TonePill tone={category.internal ? 'amber' : 'teal'}>{category.internal ? 'Internal' : 'Public'}</TonePill>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-xs text-muted">{formatNumber(category.count)} articles</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setCategoryFilter(category.id);
                          setTab('articles');
                          setPage(1);
                        }}
                      >
                        View articles
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <DemoNotice tone="neutral">Categories are grouped from the loaded articles; the demo exposes articles through the service, not the category table.</DemoNotice>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- article */

export function KbArticleDetail() {
  const services = useServices();
  const { articleId } = useParams<{ articleId: string }>();
  const id = articleId ?? '';

  const article = useAsync(() => services.knowledgeBase.get(id), [id], { skip: !id });
  const currentUser = useAsync(() => services.tenant.currentUser(), []);
  const related = useList(() => services.knowledgeBase.list({ pageSize: 4, sort: [{ field: 'views', direction: 'desc' }] }), []);

  const vote = useMutation((helpful: boolean) => services.knowledgeBase.vote(id, helpful), {
    successMessage: 'Thanks — your feedback is recorded.',
    onSuccess: () => article.reload(),
  });
  const publish = useMutation(() => services.knowledgeBase.publish(id), {
    successMessage: 'Article published.',
    onSuccess: () => article.reload(),
  });
  const submitForReview = useMutation((reviewerId: string) => services.knowledgeBase.submitForReview(id, reviewerId), {
    successMessage: 'Sent for review.',
    onSuccess: () => article.reload(),
  });

  const record = article.data;

  if (article.loading) return <ListSkeleton rows={12} columns={2} />;
  if (article.error || !record) {
    return (
      <div className="p-6">
        <Card className="flex items-center justify-center p-10">
          <div className="max-w-sm space-y-3 text-center">
            <h2 className="text-sm font-semibold text-fg">This article could not be found</h2>
            <p className="text-xs text-muted">{article.error ?? 'It may have been removed.'}</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/app/knowledge-base">Back to the knowledge base</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalVotes = record.helpfulCount + record.notHelpfulCount;
  const helpfulRate = totalVotes > 0 ? Math.round((record.helpfulCount / totalVotes) * 100) : 0;
  const reviewerId = currentUser.data?.id;

  return (
    <div className="pb-10">
      <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6">
        <RecordHeader
          backTo={{ to: '/app/knowledge-base', label: 'Knowledge base' }}
          title={record.title}
          subtitle={record.summary}
          badges={
            <>
              <StatusBadge status={record.status} />
              <Badge variant="outline" size="sm">
                {VISIBILITY_LABEL[record.visibility] ?? record.visibility}
              </Badge>
              <Badge variant="outline" size="sm">
                v{record.version}
              </Badge>
            </>
          }
          facts={[
            { label: 'Category', value: record.categoryLabel },
            { label: 'Author', value: record.authorName },
            { label: 'Review due', value: formatDate(record.reviewDueAt) },
            { label: 'Views', value: formatNumber(record.views) },
            { label: 'Linked tickets', value: formatNumber(record.linkedTicketCount) },
          ]}
          actions={
            <>
              {record.status === 'draft' && reviewerId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={submitForReview.pending}
                  leadingIcon={<Clock className="size-3.5" />}
                  onClick={() => void submitForReview.run(reviewerId)}
                >
                  Send for review
                </Button>
              ) : null}
              {record.status !== 'published' ? (
                <Button variant="primary" size="sm" loading={publish.pending} leadingIcon={<CheckCircle2 className="size-3.5" />} onClick={() => void publish.run(undefined)}>
                  Publish
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="rounded-lg border border-border-subtle bg-surface p-5 sm:p-7">
          <KbBlocks blocks={record.blocks} />
        </article>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Was this helpful?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" loading={vote.pending} leadingIcon={<ThumbsUp className="size-3.5" />} onClick={() => void vote.run(true)}>
                  Helpful
                </Button>
                <Button variant="ghost" size="sm" loading={vote.pending} leadingIcon={<ThumbsDown className="size-3.5" />} onClick={() => void vote.run(false)}>
                  Not helpful
                </Button>
              </div>
              <div className="space-y-1 text-xs text-muted">
                <p>
                  {formatNumber(record.helpfulCount)} found this helpful · {formatNumber(record.notHelpfulCount)} did not
                </p>
                <p className="font-medium text-fg">{totalVotes > 0 ? `${helpfulRate}% helpful` : 'No votes yet'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Eye className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Views" value={formatNumber(record.views)} />
              <Row label="Linked tickets" value={formatNumber(record.linkedTicketCount)} />
              <Row label="Language" value={record.language} />
              <Row label="Published" value={formatDate(record.publishedAt)} />
              <DemoNotice tone="neutral">Views and ticket links are synthetic figures from the seeded dataset.</DemoNotice>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Layers className="size-3.5 text-subtle" aria-hidden />
              <CardTitle>Most viewed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {related.loading ? (
                <ListSkeleton rows={3} columns={1} />
              ) : (
                related.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/app/knowledge-base/${item.id}`}
                    className={cn('block rounded-md border p-2.5 hover:bg-hover', item.id === record.id ? 'border-brand/40 bg-brand-subtle' : 'border-border-subtle')}
                  >
                    <span className="block truncate text-xs font-medium text-fg">{item.title}</span>
                    <span className="mt-0.5 block text-[0.6875rem] text-faint">{formatNumber(item.views)} views</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {vote.error ? <Alert tone="danger" title="Your vote could not be recorded">{vote.error}</Alert> : null}
    </div>
  );
}

/* -------------------------------------------------------------- block renderer */

function KbBlocks({ blocks }: { blocks: KbBlock[] }) {
  const headingClass: Record<number, string> = {
    2: 'mt-6 text-lg font-semibold tracking-tight text-fg first:mt-0',
    3: 'mt-5 text-base font-semibold text-fg',
    4: 'mt-4 text-sm font-semibold text-fg',
  };

  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted">
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2 key={block.id} className={headingClass[block.level] ?? headingClass[3]}>
                {block.text}
              </h2>
            );
          case 'paragraph':
            return <p key={block.id}>{block.text}</p>;
          case 'list':
            return block.ordered ? (
              <ol key={block.id} className="ms-5 list-decimal space-y-1">
                {block.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={block.id} className="ms-5 list-disc space-y-1">
                {block.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            );
          case 'steps':
            return (
              <ol key={block.id} className="space-y-2">
                {block.items.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-2xs font-semibold text-brand-fg" aria-hidden>
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case 'callout': {
            const calloutTone = block.tone === 'warning' ? 'warning' : block.tone === 'success' ? 'success' : block.tone === 'danger' ? 'danger' : 'info';
            return (
              <Alert key={block.id} tone={calloutTone}>
                {block.text}
              </Alert>
            );
          }
          case 'code':
            return (
              <pre key={block.id} className="overflow-x-auto rounded-md border border-border-subtle bg-inset p-3 text-xs">
                <code>{block.code}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={block.id} className="overflow-x-auto rounded-md border border-border-subtle">
                <table className="w-full text-xs">
                  <thead className="bg-inset">
                    <tr>
                      {block.headers.map((header, index) => (
                        <th key={index} scope="col" className="px-3 py-2 text-start font-medium text-fg">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-border-subtle">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'image_placeholder':
            return (
              <figure key={block.id} className="rounded-md border border-dashed border-border-strong bg-inset p-6 text-center">
                <FileText className="mx-auto size-6 text-faint" aria-hidden />
                <figcaption className="mt-2 text-xs text-faint">{block.alt}</figcaption>
                {block.caption ? <p className="mt-1 text-[0.6875rem] text-faint">{block.caption}</p> : null}
              </figure>
            );
          case 'video_placeholder':
            return (
              <div key={block.id} className="flex items-center justify-center rounded-md border border-dashed border-border-strong bg-inset p-8 text-xs text-faint">
                {block.caption}
              </div>
            );
          case 'divider':
            return <hr key={block.id} className="border-border-subtle" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-faint">{label}</span>
      <span className="truncate font-medium text-fg">{value}</span>
    </div>
  );
}

export { KbBlocks };
