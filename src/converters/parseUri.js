export class ParseUriValueConverter {
  toView(uri) {
  	var parseStr = uri.split('#');
  	return parseStr.length === 2 ? parseStr[1] : uri;
  }
}