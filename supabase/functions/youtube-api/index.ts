import "https://deno.land/x/xhr@0.1.0/mod.ts";
// using Deno.serve
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkDDoS } from "../_shared/ddos.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ddos = checkDDoS(req, corsHeaders, { key: 'youtube-api', limit: 30 });
  if (ddos) return ddos;

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("YouTube API request from user:", user.id);

    const { action, query, videoId, maxResults = 20 } = await req.json();
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');

    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    let url = '';
    
    switch (action) {
      case 'trending':
        url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=IN&maxResults=${maxResults}&key=${apiKey}`;
        break;
      case 'search':
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
        break;
      case 'shorts':
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=shorts&type=video&videoDuration=short&maxResults=${maxResults}&key=${apiKey}`;
        break;
      case 'video':
        url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`;
        break;
      case 'related':
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=${maxResults}&key=${apiKey}`;
        break;
      case 'channel':
        url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${query}&key=${apiKey}`;
        break;
      default:
        throw new Error('Invalid action');
    }

    console.log(`Fetching YouTube API: ${action}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      throw new Error(data.error.message);
    }

    // Transform data for easier frontend consumption
    let transformedData;
    
    if (action === 'trending' || action === 'video') {
      transformedData = data.items?.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        channel: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        views: formatViews(item.statistics?.viewCount),
        viewCount: item.statistics?.viewCount,
        duration: formatDuration(item.contentDetails?.duration),
        uploadedAt: formatDate(item.snippet.publishedAt),
        description: item.snippet.description,
      }));
    } else if (action === 'search' || action === 'shorts' || action === 'related') {
      transformedData = data.items?.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        channel: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        uploadedAt: formatDate(item.snippet.publishedAt),
        description: item.snippet.description,
      }));
    } else if (action === 'channel') {
      transformedData = data.items?.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url,
        subscribers: formatViews(item.statistics?.subscriberCount),
        videoCount: item.statistics?.videoCount,
      }));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: transformedData,
      nextPageToken: data.nextPageToken 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('YouTube API error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatViews(count: string): string {
  if (!count) return '0 views';
  const num = parseInt(count);
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B views`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M views`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K views`;
  return `${num} views`;
}

function formatDuration(duration: string): string {
  if (!duration) return '';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}