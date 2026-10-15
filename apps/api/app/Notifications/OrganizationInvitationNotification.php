<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class OrganizationInvitationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $organizationName,
        public readonly string $token
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/')
            .'/accept-invitation?token='.rawurlencode($this->token);
        return (new MailMessage)
            ->subject('Invitation to '.$this->organizationName)
            ->line('You have been invited to join '.$this->organizationName.' in the CRM.')
            ->action('Accept invitation', $url)
            ->line('This invitation expires in seven days. Only the invited email account can accept it.');
    }
}
