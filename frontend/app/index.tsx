import Constants from 'expo-constants';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href={Constants.expoConfig?.extra?.inventarioGeral ? "/coletor" : "/(tabs)/dashboard"} />;
}
