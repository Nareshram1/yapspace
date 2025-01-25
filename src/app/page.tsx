//@ts-nocheck
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
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchMessages();

    const subscription = supabase
      .from('messages')
      .on('INSERT', (payload) => {
        setMessages((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setMessages(data);
  }

  async function postMessage() {
    if (!newMessage.trim()) return;

    const { error } = await supabase.from('messages').insert({
      username: username || 'Anonymous',
      content: newMessage.trim(),
    });

    if (error) console.error(error);
    setNewMessage('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-teal-100 text-gray-800 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-6 text-teal-600">YapSpace</h1>
        <p className="text-center text-gray-600 mb-8">
          Share your thoughts or problems, connect with peers, and find support.
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
            <Button onClick={postMessage} className="w-full bg-teal-500 hover:bg-teal-600">
              Post
            </Button>
          </CardContent>
        </Card>

        <div>
          {messages.map((msg) => (
            <Card key={msg.id} className="mb-4">
              <CardContent>
                <p className="text-sm text-gray-500">
                  <strong>{msg.username}:</strong> {msg.content}
                </p>
                <p className="text-xs text-gray-400 text-right">{new Date(msg.created_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  return {
    props: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
}
