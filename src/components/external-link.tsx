import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Linking, Text } from 'react-native';

type Props = ComponentProps<typeof Text> & { href: string };

export function ExternalLink({ href, onPress, ...rest }: Props) {
  return (
    <Text
      accessibilityRole="link"
      {...rest}
      onPress={async (event) => {
        if (onPress) onPress(event);

        try {
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        } catch {
          await Linking.openURL(href);
        }
      }}
    />
  );
}
