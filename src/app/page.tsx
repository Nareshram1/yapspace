//@ts-nocheck
"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Lock, Unlock, User, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
export default function YapSpace() {
  const [state, setState] = useState({
    messages: [],
    privateMessages: [],
    newMessage: '',
    username: '',
    isPrivate: false,
    comments: {},
    newComments: {},
    showPrivate: false,
    showCommentInput: {},
    adminMode: false,
    adminPassword: ''
  });
  const CommentInput = ({ messageId, isPrivate, onSubmit }) => {
    const [comment, setComment] = useState('');
  
    const handleSubmit = () => {
      if (comment.trim()) {
        onSubmit(messageId, comment, isPrivate);
        setComment('');
      }
    };
  
    return (
      <div className="mt-3 space-y-2">
        <Textarea
          placeholder="Write a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="bg-gray-700 border-gray-600 text-gray-200 min-h-[80px]"
        />
        <Button
          onClick={handleSubmit}
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          Post Comment
        </Button>
      </div>
    );
  };
  async function fetchComments(messageId, isPrivate = false) {
    const table = isPrivate ? 'private_comments' : 'comments';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setState(prev => ({ ...prev, comments: { ...prev.comments, [messageId]: data } }));
  }

  async function postMessage() {
    if (!state.newMessage.trim()) return;

    const table = state.isPrivate ? 'private_messages' : 'messages';
    const { error } = await supabase.from(table).insert({
      username: state.username || 'Anonymous',
      content: state.newMessage.trim(),
    });

    if (error) {
      console.error(error);
      return;
    }

    setState(prev => ({ ...prev, newMessage: '' }));
    if (!state.isPrivate) await fetchMessages();
    else await fetchUserPrivateMessages();
  }

  async function postComment(messageId, content, isPrivate = false) {
    if (!content?.trim()) return;
  
    const table = isPrivate ? 'private_comments' : 'comments';
    const { error } = await supabase.from(table).insert({
      message_id: messageId,
      username: state.username || 'Anonymous',
      content: content.trim(),
    });
  
    if (error) console.error(error);
    else await fetchComments(messageId, isPrivate);
  
    setState(prev => ({
      ...prev,
      showCommentInput: { ...prev.showCommentInput, [messageId]: false }
    }));
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setState(prev => ({ ...prev, messages: data }));

    for (const message of data || []) {
      await fetchComments(message.id);
    }
  }

  async function fetchAllPrivateMessages() {
    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setState(prev => ({ ...prev, privateMessages: data }));

    for (const message of data || []) {
      await fetchComments(message.id, true);
    }
  }

  async function fetchUserPrivateMessages() {
    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .eq('username', state.username || 'Anonymous')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setState(prev => ({ ...prev, privateMessages: data }));

    for (const message of data || []) {
      await fetchComments(message.id, true);
    }
  }

  async function handlePrivateView() {
    if (state.adminPassword === '123@admin') {
      setState(prev => ({ ...prev, adminMode: true }));
      await fetchAllPrivateMessages();
    } else {
      await fetchUserPrivateMessages();
    }
    setState(prev => ({ ...prev, showPrivate: true }));
  }

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setState(prev => ({ ...prev, messages: [payload.new, ...prev.messages] }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const MessageCard = ({ msg, isPrivate }) => (
    <Card className="mb-4 overflow-hidden bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="bg-teal-900 rounded-full p-2">
            <User className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-teal-400">{msg.username}</p>
            <p className="text-gray-300 mt-1">{msg.content}</p>
            <div className="flex items-center justify-between mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-teal-400"
                onClick={() => setState(prev => ({
                  ...prev,
                  showCommentInput: { 
                    ...prev.showCommentInput,
                    [msg.id]: !prev.showCommentInput[msg.id]
                  }
                }))}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                {state.comments[msg.id]?.length || 0} Comments
              </Button>
              <span className="text-xs text-gray-500">
                {new Date(msg.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {state.showCommentInput[msg.id] && (
  <div className="mt-4 pl-12">
    <div className="space-y-2">
      {state.comments[msg.id]?.map((comment) => (
        <div key={comment.id} className="bg-gray-700 rounded-lg p-3">
          <p className="font-medium text-sm text-teal-400">{comment.username}</p>
          <p className="text-sm text-gray-300">{comment.content}</p>
        </div>
      ))}
    </div>
    <CommentInput 
      messageId={msg.id}
      isPrivate={isPrivate}
      onSubmit={postComment}
    />
  </div>
)}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-teal-400 mb-2">YapSpace</h1>
          <p className="text-gray-400">YapSpace 💬🔥—your go-to for venting, ranting, and spilling tea 🫖. Bad vibes? Work drama? Flop era? 💀 No cap, no judgment—just real talk and good vibes. Yap it out, bestie. ✨👑</p>
        </div>

        <Card className="mb-6 bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Your name"
                value={state.username}
                onChange={(e) => setState(prev => ({ ...prev, username: e.target.value }))}
                className="flex-1 bg-gray-700 border-gray-600 text-gray-200"
              />
              {state.showPrivate && !state.adminMode && (
                <Input
                  type="password"
                  placeholder="Admin password"
                  value={state.adminPassword}
                  onChange={(e) => setState(prev => ({ ...prev, adminPassword: e.target.value }))}
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-200"
                />
              )}
              <Button
                onClick={() => setState(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
                variant="outline"
                className={state.isPrivate ? "text-teal-400 border-gray-600" : "text-gray-400 border-gray-600"}
              >
                {state.isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </Button>
            </div>

            <Textarea
              placeholder={state.isPrivate ? "Send a private message..." : "Share your thoughts..."}
              value={state.newMessage}
              onChange={(e) => setState(prev => ({ ...prev, newMessage: e.target.value }))}
              className="min-h-[100px] bg-gray-700 border-gray-600 text-gray-200"
            />

            <Button 
              onClick={postMessage} 
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {state.isPrivate ? 'Send Private Message' : 'Post Publicly'}
            </Button>
          </CardContent>
        </Card>

        <div className="mb-6">
          <Button
            onClick={handlePrivateView}
            variant="outline"
            className="w-full border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            {state.showPrivate ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            {state.showPrivate ? 'View Public Posts' : 'View Private Messages'}
            {state.adminMode && <ShieldAlert className="w-4 h-4 ml-2 text-teal-400" />}
          </Button>
        </div>

        {state.showPrivate && state.privateMessages.length === 0 && (
          <Alert className="bg-gray-800 border-gray-700">
            <AlertDescription className="text-gray-300">
              No private messages found. Start a private conversation by enabling the lock icon when posting.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {!state.showPrivate
            ? state.messages.map((msg) => <MessageCard key={msg.id} msg={msg} isPrivate={false} />)
            : state.privateMessages.map((msg) => <MessageCard key={msg.id} msg={msg} isPrivate={true} />)
          }
        </div>
      </div>
    </div>
  );
}