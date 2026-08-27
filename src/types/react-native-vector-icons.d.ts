declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import type { TextStyle } from 'react-native';

  interface Props {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
  }

  export default class MaterialCommunityIcons extends Component<Props> {}
}