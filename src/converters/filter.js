export class FilterValueConverter {
  toView(array, pattern) {
    return array.filter( value => value.toLowerCase().indexOf(pattern) > -1);
  }
}