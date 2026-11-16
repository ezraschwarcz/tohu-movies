import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

import type { Film } from './films';

const KEY = 'tohu-age-confirmed';

/** R rated films ask once whether the viewer is 17 or older, the same
 *  rule as the website. Resolves true when the film may be opened. */
export async function confirmAge(film: Film): Promise<boolean> {
  if (film.rating !== 'R') return true;
  try {
    if ((await AsyncStorage.getItem(KEY)) === 'yes') return true;
  } catch {
    // fall through to asking
  }
  if (Platform.OS === 'web') {
    // Alert has no buttons on the web build; use the browser's own.
    const ok = window.confirm('This film is rated R and intended for viewers 17 and older. Are you 17 or older?');
    if (ok) void AsyncStorage.setItem(KEY, 'yes').catch(() => {});
    return ok;
  }
  return new Promise((resolve) => {
    Alert.alert(
      'This film is rated R',
      'It is intended for viewers 17 and older. Are you 17 or older?',
      [
        { text: 'No', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Yes, I am 17 or older',
          onPress: () => {
            void AsyncStorage.setItem(KEY, 'yes').catch(() => {});
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
