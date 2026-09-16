import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { AiParsedBooking, AiParseError, parseBookingEmail } from '../../utils/aiParse';

export default function PasteEmailCard({ onParsed }: { onParsed: (parsed: AiParsedBooking) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseBookingEmail(text.trim());
      onParsed(parsed);
    } catch (err) {
      setError(err instanceof AiParseError ? err.message : 'Something went wrong parsing that email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.85}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={16} color={neon.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Paste client email to pre-fill</Text>
          <Text style={styles.headerSub}>AI extracts client, schedule, venue & equipment</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={flat.textFaint} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Paste the client's email, inquiry, or quote request here..."
            placeholderTextColor={flat.textFaint}
            multiline
            numberOfLines={6}
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
            onPress={handleParse}
            disabled={!text.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <>
                <Ionicons name="sparkles" size={15} color="#0a0a0a" />
                <Text style={styles.buttonText}>Extract booking details</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: neon.purple + '30',
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: neon.purple + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.text,
  },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  input: {
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.text,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: neon.pink,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: neon.purple,
    borderRadius: 10,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
});
