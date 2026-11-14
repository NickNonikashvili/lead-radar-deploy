# Demo IMAP server: Ubuntu 24.04's Dovecot 2.3.21, the exact package the local test run used.
FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends dovecot-imapd \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /srv/mail /run/dovecot /var/lib/dovecot \
 && chown 5000:5000 /srv/mail
COPY dovecot.conf /etc/dovecot/demo.conf
COPY demo-users /etc/dovecot/demo-users
RUN chmod 0644 /etc/dovecot/demo.conf /etc/dovecot/demo-users \
 && dovecot -n -c /etc/dovecot/demo.conf > /dev/null
EXPOSE 3343
# -F: stay in the foreground; the volume at /srv/mail is chowned on every start (fresh volumes are root-owned).
CMD ["sh", "-c", "chown 5000:5000 /srv/mail && exec dovecot -F -c /etc/dovecot/demo.conf"]
