//@ts-nocheck
"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function YapSpace() {
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [comments, setComments] = useState({});
  const [newComments, setNewComments] = useState({});
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setMessages(data);

    for (const message of data) {
      await fetchComments(message.id);
    }
  }

  async function fetchPrivateMessages() {
    if (adminPassword !== 'admin123') {
      alert('Invalid admin password.');
      return;
    }

    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setPrivateMessages(data);

    for (const message of data) {
      await fetchComments(message.id, true);
    }
  }

  async function fetchComments(messageId, isPrivate = false) {
    const table = isPrivate ? 'private_comments' : 'comments';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setComments((prev) => ({ ...prev, [messageId]: data }));
  }

  async function postMessage() {
    if (!newMessage.trim()) return;

    const table = isPrivate ? 'private_messages' : 'messages';
    const { error } = await supabase.from(table).insert({
      username: username || 'Anonymous',
      content: newMessage.trim(),
    });

    if (error) console.error(error);
    setNewMessage('');
  }

  async function postComment(messageId, isPrivate = false) {
    if (!newComments[messageId]?.trim()) return;

    const table = isPrivate ? 'private_comments' : 'comments';
    const { error } = await supabase.from(table).insert({
      message_id: messageId,
      username: username || 'Anonymous',
      content: newComments[messageId].trim(),
    });

    if (error) console.error(error);
    else await fetchComments(messageId, isPrivate);

    setNewComments((prev) => ({ ...prev, [messageId]: '' }));
  }

  async function fetchUserPrivateMessages() {
    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .eq('username', username || 'Anonymous')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setPrivateMessages(data);

    for (const message of data) {
      await fetchComments(message.id, true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-teal-100 text-gray-800 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-6 text-teal-600">YapSpace</h1>
        <p className="text-center text-gray-600 mb-8">
          Share your thoughts or problems, connect with peers, or chat privately with the admin.
        </p>

        <Card className="mb-6">
          <CardContent>
            <Input
              placeholder="Your name (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-2"
            />
            <Textarea
              placeholder="What's on your mind?"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="mb-2"
            />
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mr-2"
              />
              <label>Send privately to admin</label>
            </div>
            <Button onClick={postMessage} className="w-full bg-teal-500 hover:bg-teal-600">
              {isPrivate ? 'Send to Admin' : 'Post Publicly'}
            </Button>
          </CardContent>
        </Card>

        <div className="mb-6">
          <Button
            onClick={() => {
              if (isPrivate) fetchUserPrivateMessages();
              setShowPrivate((prev) => !prev);
            }}
            className="w-full bg-teal-500 hover:bg-teal-600"
          >
            {showPrivate ? 'View Public Posts' : 'View Private Posts'}
          </Button>
        </div>

        {!showPrivate &&
          messages.map((msg) => (
            <Card key={msg.id} className="mb-4">
              <CardContent>
                <p className="text-sm text-gray-500">
                  <strong>{msg.username}:</strong> {msg.content}
                </p>
                <p className="text-xs text-gray-400 text-right">{new Date(msg.created_at).toLocaleString()}</p>

                <div className="mt-4">
                  <Textarea
                    placeholder="Add a comment"
                    value={newComments[msg.id] || ''}
                    onChange={(e) => setNewComments((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                    className="mb-2"
                  />
                  <Button
                    onClick={() => postComment(msg.id)}
                    className="bg-teal-500 hover:bg-teal-600"
                  >
                    Comment
                  </Button>
                </div>

                <div className="mt-4">
                  {comments[msg.id]?.map((comment) => (
                    <div key={comment.id} className="border-t pt-2 text-sm text-gray-600">
                      <strong>{comment.username}:</strong> {comment.content}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

        {showPrivate &&
          privateMessages.map((msg) => (
            <Card key={msg.id} className="mb-4">
              <CardContent>
                <p className="text-sm text-gray-500">
                  <strong>{msg.username}:</strong> {msg.content}
                </p>
                <p className="text-xs text-gray-400 text-right">{new Date(msg.created_at).toLocaleString()}</p>

                <div className="mt-4">
                  <Textarea
                    placeholder="Reply to this message"
                    value={newComments[msg.id] || ''}
                    onChange={(e) => setNewComments((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                    className="mb-2"
                  />
                  <Button
                    onClick={() => postComment(msg.id, true)}
                    className="bg-teal-500 hover:bg-teal-600"
                  >
                    Reply
                  </Button>
                </div>

                <div className="mt-4">
                  {comments[msg.id]?.map((comment) => (
                    <div key={comment.id} className="border-t pt-2 text-sm text-gray-600">
                      <strong>{comment.username}:</strong> {comment.content}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
