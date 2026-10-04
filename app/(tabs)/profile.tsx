import { useRouter } from 'expo-router';
import { Building2, ChevronRight, LogOut, MapPin, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CompanyLogo } from '@/components/CompanyLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { PushStatus } from '@/components/PushStatus';
import { VerificationChip } from '@/components/VerificationChip';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { confirmAction } from '@/lib/confirm';
import { isClientRole, isFreelancerRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

export default function ProfileTabScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, company, signOut } = useAuth();
  const client = isClientRole(profile?.role ?? null);
  const freelancer = isFreelancerRole(profile?.role ?? null);

  const confirmSignOut = () =>
    confirmAction({
      title: t('profile.signOutTitle'),
      message: t('profile.signOutBody'),
      confirmLabel: t('profile.signOut'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => void signOut(),
    });

  return (
    <Screen edges={['top']}>
      <View style={styles.identity}>
        <Avatar name={profile?.full_name} uri={profile?.avatar_url} size={88} />
        <Text style={styles.name}>{profile?.full_name}</Text>
        <Text style={styles.city}>{profile?.city ? t(`cities.${profile.city}`, { defaultValue: profile.city }) : ''}</Text>
        {profile?.role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{t(`profile.role.${profile.role}`)}</Text>
          </View>
        ) : null}
      </View>

      <Button variant="outline" title={t('account.editProfile')} onPress={() => router.push('/account/edit-profile')} style={styles.editProfile} />

      {client ? <Button variant="outline" title={t('account.myJobs')} onPress={() => router.push('/jobs/mine')} style={styles.editProfile} /> : null}

      {freelancer ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account.freelancerSection')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/account/verify-identity')} style={styles.verifyRow}>
            <Text style={styles.verifyText}>{t('identity.action')}</Text>
            <VerificationChip status={profile?.verification_status ?? 'none'} />
          </Pressable>
          <Button variant="outline" title={t('account.earnings')} onPress={() => router.push('/account/earnings')} />
          <Button variant="outline" title={t('account.freelancerEditAction')} onPress={() => router.push('/account/freelancer')} />
          {profile ? (
            <Button
              variant="outline"
              title={t('account.viewPublic')}
              onPress={() => router.push({ pathname: '/freelancer/[id]', params: { id: profile.id } })}
            />
          ) : null}
        </Card>
      ) : null}

      {client && company ? (
        <Card style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={company.name}
            onPress={() => router.push({ pathname: '/company/[id]', params: { id: company.id } })}
            style={styles.companyHeader}
          >
            <CompanyLogo name={company.name} uri={company.logo_url} size={56} />
            <View style={styles.companyText}>
              <Text style={styles.companyName} numberOfLines={1}>
                {company.name}
              </Text>
              {company.verification_status === 'verified' ? <VerifiedBadge /> : null}
              <View style={styles.metaRow}>
                <Users size={14} color={colors.muted} strokeWidth={1.8} />
                <Text style={styles.meta}>{t(`company.teamSizes.${company.team_size}`)}</Text>
                {company.city ? (
                  <>
                    <MapPin size={14} color={colors.muted} strokeWidth={1.8} />
                    <Text style={styles.meta}>{t(`cities.${company.city}`, { defaultValue: company.city })}</Text>
                  </>
                ) : null}
              </View>
            </View>
            <ChevronRight size={20} color={colors.muted} strokeWidth={1.8} />
          </Pressable>

          <Button variant="outline" title={t('company.card.edit')} onPress={() => router.push('/company/edit')} />

          <Pressable accessibilityRole="button" onPress={() => router.push('/company/verify')} style={styles.verifyRow}>
            <Text style={styles.verifyText}>{t('company.verify.action')}</Text>
            <VerificationChip status={company.verification_status} />
          </Pressable>
        </Card>
      ) : null}

      {client && !company ? (
        <Card style={styles.section}>
          <View style={styles.switchHeader}>
            <Building2 size={22} color={colors.accent} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>{t('company.card.switchTitle')}</Text>
          </View>
          <Text style={styles.switchBody}>{t('company.card.switchBody')}</Text>
          <Button variant="outline" title={t('company.card.switchAction')} onPress={() => router.push('/company/edit')} />
        </Card>
      ) : null}

      <PushStatus />

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('language.label')}</Text>
        <LanguagePicker />
      </Card>

      <Button
        variant="outline"
        title={t('profile.signOut')}
        icon={<LogOut size={20} color={colors.text} strokeWidth={1.8} />}
        onPress={confirmSignOut}
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  name: { ...type.heading, color: colors.text, marginTop: 8, textAlign: 'center' },
  city: { ...type.body, color: colors.muted },
  roleBadge: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.tintBlue },
  roleText: { ...type.caption, color: colors.accent },
  editProfile: { marginTop: 8 },
  section: { gap: 12, marginTop: 20 },
  sectionTitle: { ...type.subheading, color: colors.text },
  companyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  companyText: { flex: 1, gap: 4 },
  companyName: { ...type.subheading, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { ...type.small, color: colors.muted, marginRight: 6 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  verifyText: { ...type.bodyStrong, color: colors.primary },
  switchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchBody: { ...type.small, color: colors.muted },
  signOut: { marginTop: 20 },
});
