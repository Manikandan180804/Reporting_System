import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Comment } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface CommentFeedProps {
  incidentId: string;
  initialComments?: Comment[];
  onCommentAdded?: (c: Comment) => void;
}

export default function CommentFeed({ incidentId, initialComments = [], onCommentAdded }: CommentFeedProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // If initial comments provided, use them; otherwise fetch from incident endpoint
    if (initialComments.length === 0) {
      api.getIncidentById(incidentId)
        .then((inc) => setComments(inc.comments || []))
        .catch(() => {});
    }
  }, [incidentId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      const created = await api.addComment(incidentId, content.trim(), isInternal);
      // If files selected, upload them after comment creation
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          try {
            await api.uploadAttachment(incidentId, f);
          } catch (err) {
            console.error('Attachment upload failed', err);
          }
        }
      }
      setComments((s) => [...s, created]);
      setContent('');
      setIsInternal(false);
      setFiles(null);
      onCommentAdded?.(created);
    } catch (err) {
      // toast could be used; keep simple
      console.error('Failed to add comment', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Activity & Comments</Label>
        <div className="mt-2 space-y-3">
          {comments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="p-3 border rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{c.userName}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-sm">{c.content}</div>
                <div className="mt-2">
                  {c.isInternal && <Badge variant="secondary">Internal Only</Badge>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Write a comment or internal note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div>
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="text-sm" />
          {files && files.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {Array.from(files).map((f, idx) => (
                <div key={idx}>{f.name}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user && (user.role === 'responder' || user.role === 'admin') && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
                <span>Internal Only</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => { setContent(''); setIsInternal(false); }}>
              Cancel
            </Button>
            <Button type="submit" onClick={(e) => handleSubmit(e)} disabled={loading}>
              {loading ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
