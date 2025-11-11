import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  work_order_id: string | null;
  type: string;
  payload: any;
  created_at: string;
  status: string;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => n.status === "queued").length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId);
    fetchNotifications();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.work_order_id) {
      await markAsRead(notification.id);
      navigate(`/work-orders/${notification.work_order_id}`);
    }
  };

  const getPayload = (payload: any) => {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return {};
      }
    }
    return payload || {};
  };

  if (notifications.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification) => {
            const payload = getPayload(notification.payload);
            return (
              <div
                key={notification.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-accent/50 ${
                  notification.status === "queued" ? "bg-primary/5 border-primary/20" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {payload.message || "Nova notificação"}
                  </p>
                  {payload.client_name && (
                    <p className="text-xs text-muted-foreground">
                      Cliente: {payload.client_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString("pt-PT")}
                  </p>
                </div>
                {notification.status === "queued" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    Marcar como lida
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
